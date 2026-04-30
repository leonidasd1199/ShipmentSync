import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";
import { Model } from "mongoose";
import { getModelToken } from "@nestjs/mongoose";
import {
  IncotermRequirement,
  IncotermRequirementDocument,
  RequirementMode,
} from "../src/schemas/incoterm-requirement.schema";
import { Quotation, QuotationDocument } from "../src/schemas/quotation.schema";
import { Shipment, ShipmentDocument } from "../src/schemas/shipment.schema";
import {
  ShipmentDocument as ShipmentDoc,
  ShipmentDocumentDocument,
  DocumentType,
  DocumentStatus,
} from "../src/schemas/shipment-document.schema";
import {
  ShipmentLedgerLine,
  ShipmentLedgerLineDocument,
} from "../src/schemas/shipment-ledger-line.schema";
import {
  ShipmentLedgerDocument,
  ShipmentLedgerDocumentDocument,
} from "../src/schemas/shipment-ledger-document.schema";
import { Types } from "mongoose";

/**
 * E2E Tests for Shipment Operations
 *
 * Prerequisites:
 * - MongoDB must be running
 * - Test user (john.doe@shipsync.com) must have shipping permissions
 */
describe("Shipments Operations (e2e)", () => {
  let app: INestApplication<App>;
  let authToken: string;
  let testUserId: string;
  let testCompanyId: string;
  let testOfficeId: string;
  let testClientId: string;
  let testShippingLineId: string;
  let testQuotationId: string;
  let testShipmentId: string;

  let incotermRequirementModel: Model<IncotermRequirementDocument>;
  let quotationModel: Model<QuotationDocument>;
  let shipmentModel: Model<ShipmentDocument>;
  let documentModel: Model<ShipmentDocumentDocument>;
  let ledgerLineModel: Model<ShipmentLedgerLineDocument>;
  let ledgerDocumentModel: Model<ShipmentLedgerDocumentDocument>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "john.doe@shipsync.com",
        password: "password123",
      });

    if (loginResponse.status === 200) {
      authToken = loginResponse.body.access_token;
      testUserId =
        loginResponse.body.user?.id ?? loginResponse.body.user?._id;
      testCompanyId =
        loginResponse.body.user.company?.id ||
        loginResponse.body.user.company ||
        loginResponse.body.user.companyId;
      if (!testCompanyId) {
        throw new Error("Login response missing companyId for test user");
      }
      if (!testUserId) {
        throw new Error(
          "Login response missing user id (expected user.id or user._id)",
        );
      }
    } else {
      throw new Error(
        `Failed to login test user: ${JSON.stringify(loginResponse.body)}`,
      );
    }

    // Get models for cleanup (after login succeeds)
    incotermRequirementModel = moduleFixture.get<
      Model<IncotermRequirementDocument>
    >(getModelToken(IncotermRequirement.name));
    quotationModel = moduleFixture.get<Model<QuotationDocument>>(
      getModelToken(Quotation.name),
    );
    shipmentModel = moduleFixture.get<Model<ShipmentDocument>>(
      getModelToken(Shipment.name),
    );
    documentModel = moduleFixture.get<Model<ShipmentDocumentDocument>>(
      getModelToken(ShipmentDoc.name),
    );
    ledgerLineModel = moduleFixture.get<Model<ShipmentLedgerLineDocument>>(
      getModelToken(ShipmentLedgerLine.name),
    );
    ledgerDocumentModel = moduleFixture.get<
      Model<ShipmentLedgerDocumentDocument>
    >(getModelToken(ShipmentLedgerDocument.name));

    // Get helper data
    const [clientsResponse, shippingLinesResponse, officesResponse] =
      await Promise.all([
        request(app.getHttpServer())
          .get("/quotations/helpers/clients")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200),
        request(app.getHttpServer())
          .get("/quotations/helpers/shipping-lines")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200),
        request(app.getHttpServer())
          .get("/offices")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200),
      ]);

    if (
      clientsResponse.body.length > 0 &&
      shippingLinesResponse.body.length > 0 &&
      officesResponse.body.length > 0
    ) {
      testClientId = clientsResponse.body[0]._id;
      testShippingLineId = shippingLinesResponse.body[0]._id;
      testOfficeId = officesResponse.body[0]._id || officesResponse.body[0].id;
    }

    // Seed incoterm requirement for OCEAN+FOB
    await incotermRequirementModel.findOneAndUpdate(
      { mode: RequirementMode.OCEAN, incoterm: "FOB" },
      {
        mode: RequirementMode.OCEAN,
        incoterm: "FOB",
        requiredFields: [
          "transport.vesselName",
          "transport.portOfLoadingId",
          "cargo.containers",
          "parties.shipper.name",
          "parties.consignee.name",
        ],
        requiredDocuments: [DocumentType.HBL, DocumentType.COMMERCIAL_INVOICE],
        active: true,
        createdBy: new Types.ObjectId(testUserId),
      },
      { upsert: true, new: true },
    );

    // Create test quotation with items
    const quotationData = {
      serviceType: "LCL",
      incoterm: "FOB",
      clientId: new Types.ObjectId(testClientId),
      companyId: new Types.ObjectId(testCompanyId),
      shippingLineId: new Types.ObjectId(testShippingLineId),
      createdBy: new Types.ObjectId(testUserId), // Required field - convert to ObjectId
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      items: [
        {
          itemId: "item-1",
          description: "Ocean Freight",
          price: 2500,
          quantity: 1,
        },
        {
          itemId: "item-2",
          description: "Handling Fee",
          price: 500,
          quantity: 1,
        },
      ],
      pricingConfig: {
        currency: "USD",
      },
    };

    const quotation = await quotationModel.create(quotationData);
    testQuotationId = quotation._id.toString();
  }, 30000); // Increase timeout to 30 seconds for MongoDB connection

  afterAll(async () => {
    // Cleanup test data
    try {
      if (testShipmentId && documentModel && ledgerLineModel && shipmentModel) {
        await documentModel.deleteMany({
          shipmentId: new Types.ObjectId(testShipmentId),
        });
        if (ledgerDocumentModel) {
          await ledgerDocumentModel.deleteMany({
            shipmentId: new Types.ObjectId(testShipmentId),
          });
        }
        await ledgerLineModel.deleteMany({
          shipmentId: new Types.ObjectId(testShipmentId),
        });
        await shipmentModel.findByIdAndDelete(testShipmentId);
      }
      if (testQuotationId && quotationModel) {
        await quotationModel.findByIdAndDelete(testQuotationId);
      }
      if (incotermRequirementModel) {
        await incotermRequirementModel.deleteOne({
          mode: RequirementMode.OCEAN,
          incoterm: "FOB",
        });
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
    }

    if (app) {
      await app.close();
    }
  }, 60000); // Increase timeout to 60 seconds

  // =============================================================================
  // TEST 1: Shipment CRUD
  // =============================================================================

  describe("Shipment CRUD", () => {
    it("should create a shipment with status DRAFT", async () => {
      const createDto = {
        companyId: testCompanyId,
        officeId: testOfficeId,
        quotationId: testQuotationId,
        shippingLineId: testShippingLineId,
        mode: "OCEAN",
        incoterm: "FOB",
        movementType: "FCL/FCL",
        parties: {
          shipper: {
            clientId: testClientId,
            name: "Test Shipper",
            address: "123 Test St",
            contact: "test@example.com",
            rtn: "123456789",
          },
          consignee: {
            name: "Test Consignee",
            address: "456 Test Ave",
            contact: "consignee@example.com",
          },
        },
        cargo: {
          containers: [
            {
              containerNumber: "TEST123456",
              sealNumber: "SL-001",
              containerType: "40HC",
              packages: [
                {
                  type: "PALLET",
                  quantity: 10,
                  dimensions: {
                    length: 120,
                    width: 80,
                    height: 100,
                    unit: "cm",
                  },
                },
              ],
            },
          ],
          packagesQuantity: 10,
          packagesType: "PALLETS",
          goodsDescription: "Test Goods",
          grossWeightKg: 5000,
          volumeCbm: 20,
        },
        operationalUserId: testUserId,
        quotationSnapshot: {
          quotationId: testQuotationId,
          serviceType: "LCL",
          incoterm: "FOB",
          shippingMode: "maritime",
          clientId: testClientId,
          shippingLineId: testShippingLineId,
          currency: "USD",
          items: [
            {
              itemId: "item-1",
              description: "Ocean Freight",
              price: 2500,
              quantity: 1,
              discount: 0,
              applyTaxes: false,
              taxRate: null,
              notes: "Base freight rate",
              type: "COST",
            },
            {
              itemId: "item-2",
              description: "Handling Fee",
              price: 500,
              quantity: 1,
              discount: 0,
              applyTaxes: false,
              taxRate: null,
              notes: "Port handling charges",
              type: "COST",
            },
          ],
          total: 3000,
          validUntil: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      };

      const response = await request(app.getHttpServer())
        .post("/shipments")
        .set("Authorization", `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.status).toBe("DRAFT");
      expect(response.body.quotationSnapshot).toBeDefined();
      expect(response.body.quotationSnapshot.quotationId).toBe(testQuotationId);
      expect(response.body.quotationSnapshot.serviceType).toBe("LCL");
      expect(response.body.quotationSnapshot.items).toHaveLength(2);
      expect(response.body.quotationSnapshot.snapshotTakenAt).toBeDefined();
      expect(response.body.quotationSnapshot.snapshotTakenBy).toBeDefined();
      expect(response.body.cargo.containers[0].packages).toBeDefined();
      expect(response.body.cargo.containers[0].packages[0].dimensions).toBeDefined();
      testShipmentId = response.body._id || response.body.id;
    });

    it("should allow PATCH when status is DRAFT", async () => {
      if (!testShipmentId) return;

      const updateDto = {
        bookingNumber: "BK-TEST-001",
      };

      const response = await request(app.getHttpServer())
        .patch(`/shipments/${testShipmentId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.bookingNumber).toBe("BK-TEST-001");
    });

    it("should validate quotationId exists when quotationSnapshot is provided", async () => {
      const createDto = {
        companyId: testCompanyId,
        officeId: testOfficeId,
        quotationId: testQuotationId,
        mode: "OCEAN",
        incoterm: "FOB",
        parties: {
          shipper: {
            name: "Test Shipper",
            address: "123 Test St",
          },
          consignee: {
            name: "Test Consignee",
            address: "456 Test Ave",
          },
        },
        cargo: {
          containers: [
            {
              containerNumber: "TEST123456",
            },
          ],
        },
        operationalUserId: testUserId,
        quotationSnapshot: {
          quotationId: "507f1f77bcf86cd799439999", // Non-existent quotation ID
          serviceType: "LCL",
          items: [],
        },
      };

      const response = await request(app.getHttpServer())
        .post("/shipments")
        .set("Authorization", `Bearer ${authToken}`)
        .send(createDto)
        .expect(404);

      expect(response.body.message).toContain("Quotation with id");
      expect(response.body.message).toContain("not found");
    });

    it("should reject invalid container package dimensions", async () => {
      const createDto = {
        companyId: testCompanyId,
        officeId: testOfficeId,
        mode: "OCEAN",
        incoterm: "FOB",
        parties: {
          shipper: { name: "Test Shipper" },
          consignee: { name: "Test Consignee" },
        },
        cargo: {
          containers: [
            {
              containerNumber: "TEST123456",
              packages: [
                {
                  type: "PALLET",
                  quantity: 1,
                  dimensions: { length: -1, width: 80, height: 100, unit: "cm" },
                },
              ],
            },
          ],
        },
        operationalUserId: testUserId,
      };

      await request(app.getHttpServer())
        .post("/shipments")
        .set("Authorization", `Bearer ${authToken}`)
        .send(createDto)
        .expect(400);
    });

    it("should update quotationSnapshot when provided in PATCH", async () => {
      if (!testShipmentId) return;

      const updateDto = {
        quotationSnapshot: {
          quotationId: testQuotationId,
          serviceType: "FCL",
          incoterm: "CIF",
          shippingMode: "maritime",
          currency: "EUR",
          items: [
            {
              itemId: "item-updated",
              description: "Updated Item",
              price: 3000,
              quantity: 1,
              type: "COST",
            },
          ],
          total: 3000,
        },
      };

      const response = await request(app.getHttpServer())
        .patch(`/shipments/${testShipmentId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.quotationSnapshot).toBeDefined();
      expect(response.body.quotationSnapshot.serviceType).toBe("FCL");
      expect(response.body.quotationSnapshot.incoterm).toBe("CIF");
      expect(response.body.quotationSnapshot.currency).toBe("EUR");
      expect(response.body.quotationSnapshot.items).toHaveLength(1);
    });

    it("should forbid PATCH once moved to READY_FOR_FINANCE", async () => {
      if (!testShipmentId) return;

      // OCEAN readyForFinance requires BL (see DocumentEngineService.REQUIRED_DOCUMENTS)
      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/BL/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      // Add required transport fields
      await shipmentModel.findByIdAndUpdate(testShipmentId, {
        transport: {
          vesselName: "TEST VESSEL",
          portOfLoadingId: new Types.ObjectId(),
        },
      });

      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/readyForFinance`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Now try to update
      await request(app.getHttpServer())
        .patch(`/shipments/${testShipmentId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ bookingNumber: "BK-TEST-002" })
        .expect(403);
    });
  });

  // =============================================================================
  // TEST 2: Incoterm Requirements
  // =============================================================================

  describe("Incoterm Requirements", () => {
    it("should return requirement for OCEAN+FOB", async () => {
      const response = await request(app.getHttpServer())
        .get("/incotermRequirements?mode=OCEAN&incoterm=FOB")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.mode).toBe("OCEAN");
      expect(response.body.incoterm).toBe("FOB");
      expect(response.body.requiredFields).toBeInstanceOf(Array);
      expect(response.body.requiredDocuments).toBeInstanceOf(Array);
    });

    it("should return 404 for non-existent requirement", async () => {
      await request(app.getHttpServer())
        .get("/incotermRequirements?mode=AIR&incoterm=XYZ")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });
  });

  // =============================================================================
  // TEST 3: Document Generation
  // =============================================================================

  describe("Document Generation", () => {
    beforeEach(async () => {
      // Ensure shipment is in DRAFT
      if (testShipmentId) {
        await shipmentModel.findByIdAndUpdate(testShipmentId, {
          status: "DRAFT",
          lockedAt: null,
          lockedBy: null,
        });
        // Delete existing documents
        await documentModel.deleteMany({
          shipmentId: new Types.ObjectId(testShipmentId),
        });
      }
    });

    it("should generate HBL document version 1 with status GENERATED", async () => {
      if (!testShipmentId) return;

      const response = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/HBL/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.documentType).toBe("HBL");
      expect(response.body.version).toBe(1);
      expect(response.body.status).toBe("GENERATED");
      expect(response.body.storageKey).toBeDefined();
    });

    it("should increment version when generating again", async () => {
      if (!testShipmentId) return;

      // First generate version 1
      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/HBL/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      // Then generate version 2
      const response = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/HBL/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.version).toBe(2);
    });

    it("should forbid generation when document is locked", async () => {
      if (!testShipmentId) return;

      // First generate a document
      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/HBL/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      // Lock the document
      await documentModel.updateMany(
        {
          shipmentId: new Types.ObjectId(testShipmentId),
          documentType: DocumentType.HBL,
        },
        {
          status: DocumentStatus.LOCKED,
          lockedBy: new Types.ObjectId(testUserId),
          lockedAt: new Date(),
        },
      );

      // Try to generate again - should fail (API uses ConflictException → 409)
      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/HBL/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(409);
    });
  });

  // =============================================================================
  // TEST 4: READY_FOR_FINANCE Transition
  // =============================================================================

  describe("READY_FOR_FINANCE Transition", () => {
    beforeEach(async () => {
      // Reset shipment to DRAFT
      if (testShipmentId) {
        await shipmentModel.findByIdAndUpdate(testShipmentId, {
          status: "DRAFT",
          lockedAt: null,
          lockedBy: null,
        });
        await documentModel.updateMany(
          { shipmentId: new Types.ObjectId(testShipmentId) },
          { status: DocumentStatus.GENERATED, lockedAt: null, lockedBy: null },
        );
      }
    });

    it("should return 400 when required documents are missing", async () => {
      if (!testShipmentId) return;

      // Delete all documents
      await documentModel.deleteMany({
        shipmentId: new Types.ObjectId(testShipmentId),
      });

      const response = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/readyForFinance`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain("Required documents");
      expect(response.body.missingDocuments).toBeInstanceOf(Array);
    });

    it("should return 400 when required fields are missing", async () => {
      if (!testShipmentId) return;

      // Satisfy required docs for OCEAN (BL), then remove a required shipment field
      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/BL/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      // Remove transport.vesselName
      await shipmentModel.findByIdAndUpdate(testShipmentId, {
        $unset: { "transport.vesselName": "" },
      });

      const response = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/readyForFinance`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain("Required fields");
      expect(response.body.missingFields).toBeInstanceOf(Array);
    });

    it("should transition to READY_FOR_FINANCE and lock documents when all requirements met", async () => {
      if (!testShipmentId) return;

      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/BL/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      // Ensure required fields are present
      await shipmentModel.findByIdAndUpdate(testShipmentId, {
        transport: {
          vesselName: "TEST VESSEL",
          portOfLoadingId: new Types.ObjectId(),
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/readyForFinance`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe("READY_FOR_FINANCE");
      expect(response.body.lockedAt).toBeDefined();
      expect(response.body.lockedBy).toBeDefined();

      // Small delay to ensure database writes are complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify documents are locked (check latest version of each document type)
      const blDoc = await documentModel
        .findOne({
          shipmentId: new Types.ObjectId(testShipmentId),
          documentType: DocumentType.BL,
        })
        .sort({ version: -1 })
        .exec();

      expect(blDoc).toBeDefined();
      if (!blDoc) {
        throw new Error("BL document not found after readyForFinance");
      }

      expect(blDoc.status).toBe(DocumentStatus.LOCKED);
      expect(blDoc.lockedAt).toBeDefined();
      expect(blDoc.lockedBy).toBeDefined();
    });

    it("should forbid generating same docType after lock", async () => {
      if (!testShipmentId) return;

      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/BL/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      // Ensure required fields are present
      await shipmentModel.findByIdAndUpdate(testShipmentId, {
        transport: {
          vesselName: "TEST VESSEL",
          portOfLoadingId: new Types.ObjectId(),
        },
      });

      // Transition to READY_FOR_FINANCE (this locks documents)
      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/readyForFinance`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Try to generate BL again after it's locked - should fail
      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/BL/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(409);
    });
  });

  // =============================================================================
  // TEST 5: Ledger Import + Profit
  // =============================================================================

  describe("Ledger Import and Profit", () => {
    beforeEach(async () => {
      // Clean up ledger lines
      if (testShipmentId) {
        await ledgerLineModel.deleteMany({
          shipmentId: new Types.ObjectId(testShipmentId),
        });
      }
    });

    it("should import items from quotation as ledger lines with source QUOTATION_ITEM", async () => {
      if (!testShipmentId || !testQuotationId) return;

      const importDto = {
        quotationId: testQuotationId,
        itemIds: ["item-1", "item-2"],
      };

      const response = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledger/importFromQuotation`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(importDto)
        .expect(201);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0].source).toBe("QUOTATION_ITEM");
      expect(response.body[0].sourceRefId).toBe("item-1");
      expect(response.body[0].sourceQuotationId).toBe(testQuotationId);
      expect(response.body[0].status).toBe("DRAFT");
      expect(response.body[0].supplierId).toBe(testShippingLineId);
      expect(response.body[0].supplier).toBeDefined();
      expect(response.body[0].supplier.id).toBe(testShippingLineId);
      expect(response.body[0].supplier.name).toEqual(expect.any(String));
    });

    it("should calculate profit using only APPROVED lines", async () => {
      if (!testShipmentId) return;

      // Create manual debit and credit lines
      const createDebitResponse = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "DEBIT",
          description: "Test Debit",
          amount: 1000,
          currency: "USD",
        })
        .expect(201);

      expect(createDebitResponse.body.supplierId).toBe(testShippingLineId);
      expect(createDebitResponse.body.supplier).toBeDefined();
      expect(createDebitResponse.body.supplier.id).toBe(testShippingLineId);
      expect(createDebitResponse.body.supplier.name).toEqual(expect.any(String));

      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "CREDIT",
          description: "Test Credit",
          amount: 2000,
          currency: "USD",
        })
        .expect(201);

      // Get ledger lines
      const linesResponse = await request(app.getHttpServer())
        .get(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const debitLine = linesResponse.body.find(
        (l: any) => l.side === "DEBIT",
      );
      const creditLine = linesResponse.body.find(
        (l: any) => l.side === "CREDIT",
      );
      expect(debitLine.supplier).toBeDefined();
      expect(debitLine.supplier.id).toBe(testShippingLineId);
      expect(debitLine.supplier.name).toEqual(expect.any(String));

      // Submit and approve both lines
      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines/${debitLine._id}/submit`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines/${creditLine._id}/submit`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines/${debitLine._id}/approve`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines/${creditLine._id}/approve`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Calculate profit
      const profitResponse = await request(app.getHttpServer())
        .get(`/shipments/${testShipmentId}/profit`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(profitResponse.body.debitTotal).toBe(1000);
      expect(profitResponse.body.creditTotal).toBe(2000);
      expect(profitResponse.body.profit).toBe(1000);
      expect(profitResponse.body.debits).toHaveLength(1);
      expect(profitResponse.body.credits).toHaveLength(1);
      expect(profitResponse.body.debits[0].supplier).toBeDefined();
      expect(profitResponse.body.debits[0].supplier.id).toBe(testShippingLineId);
      expect(profitResponse.body.debits[0].supplier.name).toEqual(expect.any(String));
    });

    it("should store rejectedReason when rejecting a line", async () => {
      if (!testShipmentId) return;

      // Create and submit a line
      const createResponse = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "DEBIT",
          description: "Test Reject",
          amount: 500,
          currency: "USD",
        })
        .expect(201);

      const lineId = createResponse.body._id || createResponse.body.id;

      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines/${lineId}/submit`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Reject with reason
      const rejectResponse = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines/${lineId}/reject`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ reason: "Amount exceeds budget" })
        .expect(200);

      expect(rejectResponse.body.status).toBe("REJECTED");
      expect(rejectResponse.body.rejectedReason).toBe("Amount exceeds budget");
      expect(rejectResponse.body.rejectedAt).toBeDefined();
    });

    it("should sync existing ledger supplierId when shipment shippingLineId changes", async () => {
      if (!testShipmentId || !testShippingLineId) return;

      const shippingLinesResponse = await request(app.getHttpServer())
        .get("/quotations/helpers/shipping-lines")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);
      const secondSupplier = (shippingLinesResponse.body || []).find(
        (s: any) => (s._id || s.id) !== testShippingLineId,
      );
      if (!secondSupplier) return;
      const secondSupplierId = secondSupplier._id || secondSupplier.id;

      const createResponse = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "DEBIT",
          description: "Supplier sync line",
          amount: 100,
          currency: "USD",
        })
        .expect(201);

      expect(createResponse.body.supplierId).toBe(testShippingLineId);

      await request(app.getHttpServer())
        .patch(`/shipments/${testShipmentId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ shippingLineId: secondSupplierId })
        .expect(200);

      const linesResponse = await request(app.getHttpServer())
        .get(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const synced = linesResponse.body.find(
        (l: any) => l._id === createResponse.body._id,
      );
      expect(synced).toBeDefined();
      expect(synced.supplierId).toBe(secondSupplierId);
      expect(synced.supplier).toBeDefined();
      expect(synced.supplier.id).toBe(secondSupplierId);
      expect(synced.supplier.name).toEqual(expect.any(String));
    });
  });

  describe("Ledger line documents (DEBIT attachments)", () => {
    beforeEach(async () => {
      if (testShipmentId && ledgerDocumentModel && ledgerLineModel) {
        await ledgerDocumentModel.deleteMany({
          shipmentId: new Types.ObjectId(testShipmentId),
        });
        await ledgerLineModel.deleteMany({
          shipmentId: new Types.ObjectId(testShipmentId),
        });
      }
    });

    it("should upload a document to a DEBIT ledger line and list newest first", async () => {
      if (!testShipmentId) return;

      const debitRes = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "DEBIT",
          description: "Cost with attachment",
          amount: 100,
          currency: "USD",
        })
        .expect(201);

      const lineId = debitRes.body._id || debitRes.body.id;
      const pdf1 = Buffer.from("%PDF-1.4 ledger doc 1");
      const pdf2 = Buffer.from("%PDF-1.4 ledger doc 2");

      const up1 = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines/${lineId}/documents`)
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", pdf1, { filename: "invoice-a.pdf", contentType: "application/pdf" })
        .expect(201);

      expect(up1.body._id).toBeDefined();
      expect(up1.body.shipmentId).toBe(testShipmentId);
      expect(up1.body.ledgerLineId).toBe(lineId);
      expect(up1.body.mimeType).toBe("application/pdf");
      expect(up1.body.size).toBe(pdf1.length);
      expect(up1.body.storageKey).toContain("ledger-documents");
      expect(up1.body.originalFileName).toBe("invoice-a.pdf");
      expect(up1.body.uploadedBy).toBe(testUserId);

      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines/${lineId}/documents`)
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", pdf2, { filename: "invoice-b.pdf", contentType: "application/pdf" })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get(`/shipments/${testShipmentId}/ledgerLines/${lineId}/documents`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(list.body)).toBe(true);
      expect(list.body.length).toBe(2);
      expect(list.body[0].originalFileName).toBe("invoice-b.pdf");
      expect(list.body[1].originalFileName).toBe("invoice-a.pdf");

      const creditRes = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "CREDIT",
          description: "Revenue row",
          amount: 50,
          currency: "USD",
        })
        .expect(201);
      const creditLineId = creditRes.body._id || creditRes.body.id;

      const linesWithCounts = await request(app.getHttpServer())
        .get(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const debitRow = linesWithCounts.body.find((l: any) => l._id === lineId);
      const creditRow = linesWithCounts.body.find(
        (l: any) => l._id === creditLineId,
      );
      expect(debitRow.documentsCount).toBe(2);
      expect(debitRow.hasDocuments).toBe(true);
      expect(creditRow.documentsCount).toBe(0);
      expect(creditRow.hasDocuments).toBe(false);
    });

    it("should reject upload for CREDIT ledger line", async () => {
      if (!testShipmentId) return;

      const creditRes = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "CREDIT",
          description: "Revenue",
          amount: 200,
          currency: "USD",
        })
        .expect(201);

      const lineId = creditRes.body._id || creditRes.body.id;
      const pdf = Buffer.from("%PDF-1.4");

      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines/${lineId}/documents`)
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", pdf, { filename: "x.pdf", contentType: "application/pdf" })
        .expect(400);
    });

    it("should reject upload when ledger line does not belong to shipment", async () => {
      if (!testShipmentId || !testQuotationId) return;

      const debitRes = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "DEBIT",
          description: "Other shipment mismatch",
          amount: 50,
          currency: "USD",
        })
        .expect(201);

      const lineId = debitRes.body._id || debitRes.body.id;

      const otherShipmentDto = {
        companyId: testCompanyId,
        officeId: testOfficeId,
        quotationId: testQuotationId,
        shippingLineId: testShippingLineId,
        mode: "OCEAN",
        incoterm: "FOB",
        movementType: "FCL/FCL",
        parties: {
          shipper: {
            clientId: testClientId,
            name: "Other Shipper",
            address: "1 St",
          },
          consignee: { name: "Other Consignee", address: "2 Ave" },
        },
        cargo: {
          containers: [
            {
              containerNumber: "OTHER1234567",
              containerType: "40HC",
              packages: [
                {
                  type: "PALLET",
                  quantity: 1,
                  dimensions: {
                    length: 100,
                    width: 80,
                    height: 60,
                    unit: "cm",
                  },
                },
              ],
            },
          ],
          goodsDescription: "G",
          grossWeightKg: 1,
          volumeCbm: 1,
        },
        operationalUserId: testUserId,
        quotationSnapshot: {
          quotationId: testQuotationId,
          serviceType: "LCL",
          incoterm: "FOB",
          shippingMode: "maritime",
          clientId: testClientId,
          shippingLineId: testShippingLineId,
          currency: "USD",
          items: [
            {
              itemId: "item-1",
              description: "Ocean Freight",
              price: 2500,
              quantity: 1,
              discount: 0,
              applyTaxes: false,
              taxRate: null,
              notes: "",
              type: "COST",
            },
          ],
          total: 2500,
          validUntil: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      };

      const otherRes = await request(app.getHttpServer())
        .post("/shipments")
        .set("Authorization", `Bearer ${authToken}`)
        .send(otherShipmentDto)
        .expect(201);

      const otherShipmentId = otherRes.body._id || otherRes.body.id;
      const pdf = Buffer.from("%PDF-1.4");

      await request(app.getHttpServer())
        .post(
          `/shipments/${otherShipmentId}/ledgerLines/${lineId}/documents`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", pdf, { filename: "x.pdf", contentType: "application/pdf" })
        .expect(400);

      await shipmentModel.findByIdAndDelete(otherShipmentId);
    });

    it("should return 404 when shipment does not exist", async () => {
      if (!testShipmentId) return;

      const debitRes = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "DEBIT",
          description: "X",
          amount: 1,
          currency: "USD",
        })
        .expect(201);

      const lineId = debitRes.body._id || debitRes.body.id;
      const fakeShipmentId = "507f1f77bcf86cd799439099";
      const pdf = Buffer.from("%PDF-1.4");

      await request(app.getHttpServer())
        .post(
          `/shipments/${fakeShipmentId}/ledgerLines/${lineId}/documents`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", pdf, { filename: "x.pdf", contentType: "application/pdf" })
        .expect(404);
    });

    it("should return 404 when ledger line does not exist", async () => {
      if (!testShipmentId) return;

      const fakeLineId = "507f1f77bcf86cd799439088";
      const pdf = Buffer.from("%PDF-1.4");

      await request(app.getHttpServer())
        .post(
          `/shipments/${testShipmentId}/ledgerLines/${fakeLineId}/documents`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", pdf, { filename: "x.pdf", contentType: "application/pdf" })
        .expect(404);
    });

    it("should delete a ledger document and omit it from GET list", async () => {
      if (!testShipmentId) return;

      const debitRes = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "DEBIT",
          description: "Cost for delete test",
          amount: 10,
          currency: "USD",
        })
        .expect(201);

      const lineId = debitRes.body._id || debitRes.body.id;
      const pdfKeep = Buffer.from("%PDF-1.4 keep");
      const pdfGone = Buffer.from("%PDF-1.4 gone");

      const upKeep = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines/${lineId}/documents`)
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", pdfKeep, {
          filename: "keep.pdf",
          contentType: "application/pdf",
        })
        .expect(201);

      const upGone = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines/${lineId}/documents`)
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", pdfGone, {
          filename: "gone.pdf",
          contentType: "application/pdf",
        })
        .expect(201);

      const docIdGone = upGone.body._id || upGone.body.id;

      const del = await request(app.getHttpServer())
        .delete(
          `/shipments/${testShipmentId}/ledgerLines/${lineId}/documents/${docIdGone}`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(del.body.documentId).toBe(docIdGone);
      expect(del.body.isActive).toBe(false);

      const list = await request(app.getHttpServer())
        .get(`/shipments/${testShipmentId}/ledgerLines/${lineId}/documents`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(list.body).toHaveLength(1);
      expect(String(list.body[0]._id)).toBe(
        String(upKeep.body._id ?? upKeep.body.id),
      );
      expect(String(list.body[0]._id)).not.toBe(String(docIdGone));
      expect(list.body[0].originalFileName).toBe("keep.pdf");
    });

    it("should return 404 when deleting non-existent document on CREDIT line", async () => {
      if (!testShipmentId) return;

      const creditRes = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "CREDIT",
          description: "Revenue",
          amount: 5,
          currency: "USD",
        })
        .expect(201);

      const creditLineId = creditRes.body._id || creditRes.body.id;

      await request(app.getHttpServer())
        .delete(
          `/shipments/${testShipmentId}/ledgerLines/${creditLineId}/documents/507f1f77bcf86cd799439011`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });

    it("should reject DELETE when document does not belong to the ledger line", async () => {
      if (!testShipmentId) return;

      const line1 = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "DEBIT",
          description: "Line one",
          amount: 1,
          currency: "USD",
        })
        .expect(201);

      const line2 = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "DEBIT",
          description: "Line two",
          amount: 2,
          currency: "USD",
        })
        .expect(201);

      const id1 = line1.body._id || line1.body.id;
      const id2 = line2.body._id || line2.body.id;

      const up = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines/${id1}/documents`)
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from("%PDF-1.4"), {
          filename: "only-line1.pdf",
          contentType: "application/pdf",
        })
        .expect(201);

      const docId = up.body._id || up.body.id;

      await request(app.getHttpServer())
        .delete(
          `/shipments/${testShipmentId}/ledgerLines/${id2}/documents/${docId}`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);
    });

    it("should reject DELETE when ledger line does not belong to shipment", async () => {
      if (!testShipmentId || !testQuotationId) return;

      const debitRes = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "DEBIT",
          description: "Belongs to test shipment",
          amount: 3,
          currency: "USD",
        })
        .expect(201);

      const lineId = debitRes.body._id || debitRes.body.id;

      const up = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/ledgerLines/${lineId}/documents`)
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from("%PDF-1.4"), {
          filename: "x.pdf",
          contentType: "application/pdf",
        })
        .expect(201);

      const docId = up.body._id || up.body.id;

      const otherShipmentDto = {
        companyId: testCompanyId,
        officeId: testOfficeId,
        quotationId: testQuotationId,
        shippingLineId: testShippingLineId,
        mode: "OCEAN",
        incoterm: "FOB",
        movementType: "FCL/FCL",
        parties: {
          shipper: {
            clientId: testClientId,
            name: "Del Other Shipper",
            address: "1 St",
          },
          consignee: { name: "Del Other Consignee", address: "2 Ave" },
        },
        cargo: {
          containers: [
            {
              containerNumber: "DEL1234567",
              containerType: "40HC",
              packages: [
                {
                  type: "PALLET",
                  quantity: 1,
                  dimensions: {
                    length: 100,
                    width: 80,
                    height: 60,
                    unit: "cm",
                  },
                },
              ],
            },
          ],
          goodsDescription: "G",
          grossWeightKg: 1,
          volumeCbm: 1,
        },
        operationalUserId: testUserId,
        quotationSnapshot: {
          quotationId: testQuotationId,
          serviceType: "LCL",
          incoterm: "FOB",
          shippingMode: "maritime",
          clientId: testClientId,
          shippingLineId: testShippingLineId,
          currency: "USD",
          items: [
            {
              itemId: "item-1",
              description: "Ocean Freight",
              price: 2500,
              quantity: 1,
              discount: 0,
              applyTaxes: false,
              taxRate: null,
              notes: "",
              type: "COST",
            },
          ],
          total: 2500,
          validUntil: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      };

      const otherRes = await request(app.getHttpServer())
        .post("/shipments")
        .set("Authorization", `Bearer ${authToken}`)
        .send(otherShipmentDto)
        .expect(201);

      const otherShipmentId = otherRes.body._id || otherRes.body.id;

      await request(app.getHttpServer())
        .delete(
          `/shipments/${otherShipmentId}/ledgerLines/${lineId}/documents/${docId}`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      await shipmentModel.findByIdAndDelete(otherShipmentId);
    });
  });
});