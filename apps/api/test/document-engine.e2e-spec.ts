import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";
import { Model } from "mongoose";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { Shipment, ShipmentDocument, ShipmentMode } from "../src/schemas/shipment.schema";
import {
  ShipmentDocument as ShipmentDoc,
  ShipmentDocumentDocument,
  DocumentType,
  DocumentStatus,
} from "../src/schemas/shipment-document.schema";
import {
  DocumentTemplate,
  DocumentTemplateDocument,
} from "../src/schemas/document-template.schema";
import {
  IncotermRequirement,
  IncotermRequirementDocument,
  RequirementMode,
} from "../src/schemas/incoterm-requirement.schema";
import { existsSync, rmSync } from "fs";
import { join } from "path";
import { seedTemplates } from "../src/shipments/helpers/seed-templates";

/**
 * E2E Tests for Document Engine
 *
 * Prerequisites:
 * - MongoDB must be running
 * - Test user (john.doe@shipsync.com) must have shipping permissions
 * - Document templates must be seeded (via migration or test setup)
 */
describe("Document Engine (e2e)", () => {
  let app: INestApplication<App>;
  let authToken: string;
  let testUserId: string;
  let testCompanyId: string;
  let testOfficeId: string;
  let testClientId: string;
  let testShipmentId: string;

  let shipmentModel: Model<ShipmentDocument>;
  let documentModel: Model<ShipmentDocumentDocument>;
  let templateModel: Model<DocumentTemplateDocument>;
  let incotermRequirementModel: Model<IncotermRequirementDocument>;

  const storageBasePath = join(process.cwd(), "storage");

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
      testUserId = loginResponse.body.user._id;
      testCompanyId =
        loginResponse.body.user.company?.id ||
        loginResponse.body.user.company ||
        loginResponse.body.user.companyId;
      if (!testCompanyId) {
        throw new Error("Login response missing companyId for test user");
      }
    } else {
      throw new Error(
        `Failed to login test user: ${JSON.stringify(loginResponse.body)}`,
      );
    }

    // Get models
    shipmentModel = moduleFixture.get<Model<ShipmentDocument>>(
      getModelToken(Shipment.name),
    );
    documentModel = moduleFixture.get<Model<ShipmentDocumentDocument>>(
      getModelToken(ShipmentDoc.name),
    );
    templateModel = moduleFixture.get<Model<DocumentTemplateDocument>>(
      getModelToken(DocumentTemplate.name),
    );
    incotermRequirementModel = moduleFixture.get<
      Model<IncotermRequirementDocument>
    >(getModelToken(IncotermRequirement.name));

    // Get helper data - use same pattern as shipments test
    const [clientsResponse, officesResponse] = await Promise.all([
      request(app.getHttpServer())
        .get("/quotations/helpers/clients")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200),
      request(app.getHttpServer())
        .get("/offices")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200),
    ]);

    if (
      clientsResponse.body.length > 0 &&
      officesResponse.body.length > 0
    ) {
      testClientId = clientsResponse.body[0]._id;
      testOfficeId = officesResponse.body[0]._id || officesResponse.body[0].id;
    }

    // Seed templates - ensure active template exists for each mode+documentType
    for (const template of seedTemplates) {
      const existingActive = await templateModel.findOne({
        mode: template.mode,
        documentType: template.documentType,
        isActive: true,
      });

      if (!existingActive) {
        // Deactivate any existing templates for this mode+documentType (in case there are inactive ones)
        await templateModel.updateMany(
          {
            mode: template.mode,
            documentType: template.documentType,
          },
          { isActive: false },
        );

        // Create new active template
        await templateModel.create({
          mode: template.mode,
          documentType: template.documentType,
          templateVersion: 1,
          html: template.html.trim(),
          css: (template.css || "").trim(),
          isActive: true,
          createdBy: new Types.ObjectId(testUserId),
        });
      }
    }

    // Seed incoterm requirements for tests
    // OCEAN + FOB
    await incotermRequirementModel.findOneAndUpdate(
      { mode: RequirementMode.OCEAN, incoterm: "FOB" },
      {
        mode: RequirementMode.OCEAN,
        incoterm: "FOB",
        requiredFields: [
          "transport.vesselName",
          "cargo.containers",
          "parties.shipper.name",
          "parties.consignee.name",
        ],
        requiredDocuments: [DocumentType.BL],
        active: true,
        createdBy: new Types.ObjectId(testUserId),
      },
      { upsert: true, new: true },
    );

    // LAND + EXW
    await incotermRequirementModel.findOneAndUpdate(
      { mode: RequirementMode.LAND, incoterm: "EXW" },
      {
        mode: RequirementMode.LAND,
        incoterm: "EXW",
        requiredFields: [
          "transport.land.cartaPorteNumber",
          "transport.land.placeOfLoading",
          "parties.shipper.name",
          "parties.consignee.name",
        ],
        requiredDocuments: [
          DocumentType.CARTA_PORTE,
          DocumentType.MANIFIESTO_CARGA,
        ],
        active: true,
        createdBy: new Types.ObjectId(testUserId),
      },
      { upsert: true, new: true },
    );

    // AIR + FOB
    await incotermRequirementModel.findOneAndUpdate(
      { mode: RequirementMode.AIR, incoterm: "FOB" },
      {
        mode: RequirementMode.AIR,
        incoterm: "FOB",
        requiredFields: [
          "transport.air.hawbNumber",
          "transport.air.airportOfDeparture",
          "parties.shipper.name",
          "parties.consignee.name",
        ],
        requiredDocuments: [DocumentType.HAWB],
        active: true,
        createdBy: new Types.ObjectId(testUserId),
      },
      { upsert: true, new: true },
    );
  }, 60000);

  afterAll(async () => {
    // Cleanup test storage
    const testStoragePath = join(storageBasePath, "shipments");
    if (existsSync(testStoragePath)) {
      rmSync(testStoragePath, { recursive: true, force: true });
    }

    // Cleanup test data
    if (testShipmentId) {
      await documentModel.deleteMany({
        shipmentId: new Types.ObjectId(testShipmentId),
      });
      await shipmentModel.findByIdAndDelete(testShipmentId);
    }

    await app.close();
  }, 60000);

  beforeEach(async () => {
    // Clean up documents before each test
    if (testShipmentId) {
      await documentModel.deleteMany({
        shipmentId: new Types.ObjectId(testShipmentId),
      });
    }
  });

  describe("Document Templates", () => {
    it("should list templates with filters", async () => {
      const response = await request(app.getHttpServer())
        .get("/documentTemplates")
        .query({ mode: "OCEAN", documentType: "BL", active: true })
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should create a template", async () => {
      const templateData = {
        mode: "OCEAN",
        documentType: "BL",
        html: "<h1>Test Template</h1><p>{{shipment.bookingNumber}}</p>",
        css: "body { font-family: Arial; }",
      };

      const response = await request(app.getHttpServer())
        .post("/documentTemplates")
        .set("Authorization", `Bearer ${authToken}`)
        .send(templateData)
        .expect(201);

      expect(response.body.mode).toBe("OCEAN");
      expect(response.body.documentType).toBe("BL");
      expect(response.body.html).toContain("Test Template");
      expect(response.body.isActive).toBe(true);

      // Cleanup
      await templateModel.findByIdAndDelete(response.body._id);
    });

    it("should activate template and deactivate others", async () => {
      // Create two templates
      const template1 = await templateModel.create({
        mode: "OCEAN",
        documentType: "BL",
        templateVersion: 1,
        html: "<h1>Template 1</h1>",
        isActive: true,
        createdBy: new Types.ObjectId(testUserId),
      });

      const template2 = await templateModel.create({
        mode: "OCEAN",
        documentType: "BL",
        templateVersion: 2,
        html: "<h1>Template 2</h1>",
        isActive: false,
        createdBy: new Types.ObjectId(testUserId),
      });

      // Activate template2
      const response = await request(app.getHttpServer())
        .post(`/documentTemplates/${template2._id}/activate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isActive).toBe(true);

      // Verify template1 is deactivated
      const updatedTemplate1 = await templateModel.findById(template1._id);
      expect(updatedTemplate1?.isActive).toBe(false);

      // Cleanup
      await templateModel.findByIdAndDelete(template1._id);
      await templateModel.findByIdAndDelete(template2._id);
    });
  });

  describe("Document Generation", () => {
    beforeEach(async () => {
      // Ensure templates exist (they might have been deleted by previous tests)
      for (const template of seedTemplates) {
        const existingActive = await templateModel.findOne({
          mode: template.mode,
          documentType: template.documentType,
          isActive: true,
        });

        if (!existingActive) {
          // Deactivate any existing templates for this mode+documentType
          await templateModel.updateMany(
            {
              mode: template.mode,
              documentType: template.documentType,
            },
            { isActive: false },
          );

          // Create new active template
          await templateModel.create({
            mode: template.mode,
            documentType: template.documentType,
            templateVersion: 1,
            html: template.html.trim(),
            css: (template.css || "").trim(),
            isActive: true,
            createdBy: new Types.ObjectId(testUserId),
          });
        }
      }

      // Create a test shipment
      const shipmentData = {
        companyId: new Types.ObjectId(testCompanyId),
        officeId: new Types.ObjectId(testOfficeId),
        mode: ShipmentMode.OCEAN,
        incoterm: "FOB",
        movementType: "FCL/FCL",
        parties: {
          shipper: {
            name: "Test Shipper",
            address: "123 Shipper St",
            contact: "shipper@test.com",
          },
          consignee: {
            name: "Test Consignee",
            address: "456 Consignee Ave",
            contact: "consignee@test.com",
          },
        },
        cargo: {
          containers: [
            {
              containerNumber: "CONT123456",
              sealNumber: "SEAL789",
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
          goodsDescription: "Test Cargo",
          grossWeightKg: 5000,
          volumeCbm: 25,
        },
        transport: {
          vesselName: "Test Vessel",
          voyageNumber: "V001",
          placeOfReceipt: "Port A",
          placeOfDelivery: "Port B",
        },
        operationalUserId: new Types.ObjectId(testUserId),
        createdBy: new Types.ObjectId(testUserId),
      };

      const shipment = await shipmentModel.create(shipmentData);
      testShipmentId = shipment._id.toString();
    });

    it("should generate v1 and v2 for a doc type in DRAFT", async () => {
      // Generate v1
      const response1 = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      expect(response1.body.version).toBe(1);
      expect(response1.body.status).toBe(DocumentStatus.GENERATED);
      expect(response1.body.documentType).toBe(DocumentType.BL);
      // Verify downloadUrl is present
      expect(response1.body.downloadUrl).toBeDefined();
      expect(response1.body.downloadUrl).toContain(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/download`);
      expect(response1.body.downloadUrl).toContain("version=1");

      // Generate v2
      const response2 = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      expect(response2.body.version).toBe(2);
      expect(response2.body.status).toBe(DocumentStatus.GENERATED);
      // Verify downloadUrl is present and correct
      expect(response2.body.downloadUrl).toBeDefined();
      expect(response2.body.downloadUrl).toContain("version=2");

      // Verify files exist on disk
      const storageKey1 = response1.body.storageKey;
      const storageKey2 = response2.body.storageKey;
      const filePath1 = join(storageBasePath, storageKey1);
      const filePath2 = join(storageBasePath, storageKey2);

      expect(existsSync(filePath1)).toBe(true);
      expect(existsSync(filePath2)).toBe(true);
    });

    it("should download latest and version=1 returns PDF content-type", async () => {
      // Generate documents
      const response1 = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      // Download latest
      const latestResponse = await request(app.getHttpServer())
        .get(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/download`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(latestResponse.headers["content-type"]).toContain("application/pdf");
      expect(latestResponse.body.length).toBeGreaterThan(0);

      // Download version 1
      const version1Response = await request(app.getHttpServer())
        .get(
          `/shipments/${testShipmentId}/documents/${DocumentType.BL}/download?version=1`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(version1Response.headers["content-type"]).toContain("application/pdf");
      expect(version1Response.body.length).toBeGreaterThan(0);
    });

    it("should return downloadUrl in generate response and it should work", async () => {
      // Generate document
      const generateResponse = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      // Verify downloadUrl is present in response
      expect(generateResponse.body.downloadUrl).toBeDefined();
      expect(generateResponse.body.downloadUrl).toBe(
        `/shipments/${testShipmentId}/documents/${DocumentType.BL}/download?version=${generateResponse.body.version}`,
      );

      // Test that the downloadUrl actually works
      const downloadResponse = await request(app.getHttpServer())
        .get(generateResponse.body.downloadUrl)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(downloadResponse.headers["content-type"]).toContain("application/pdf");
      expect(downloadResponse.body.length).toBeGreaterThan(0);
    });

    it("should validate mode: AIR shipment cannot generate BL (400)", async () => {
      // Create AIR shipment
      const airShipment = await shipmentModel.create({
        companyId: new Types.ObjectId(testCompanyId),
        officeId: new Types.ObjectId(testOfficeId),
        mode: ShipmentMode.AIR,
        incoterm: "FOB",
        movementType: "AIR",
        parties: {
          shipper: {
            name: "Test Shipper",
            address: "123 Shipper St",
            contact: "shipper@test.com",
          },
          consignee: {
            name: "Test Consignee",
            address: "456 Consignee Ave",
            contact: "consignee@test.com",
          },
        },
        cargo: {
          containers: [],
          packagesQuantity: 5,
          packagesType: "BOXES",
          goodsDescription: "Air Cargo",
          grossWeightKg: 100,
        },
        transport: {
          air: {
            hawbNumber: "HAWB123",
            airportOfDeparture: "LAX",
            airportOfDestination: "JFK",
          },
        },
        operationalUserId: new Types.ObjectId(testUserId),
        createdBy: new Types.ObjectId(testUserId),
      });

      const response = await request(app.getHttpServer())
        .post(
          `/shipments/${airShipment._id}/documents/${DocumentType.BL}/generate`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain("not allowed");

      // Cleanup
      await shipmentModel.findByIdAndDelete(airShipment._id);
    });

    it("should forbid generation when latest document is locked", async () => {
      // Generate v1
      const v1Response = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      const v1DocId = v1Response.body._id;

      // Manually lock v1 (latest document)
      await documentModel.findByIdAndUpdate(v1DocId, {
        status: DocumentStatus.LOCKED,
        lockedBy: new Types.ObjectId(testUserId),
        lockedAt: new Date(),
      });

      // Try to generate v2 (should fail because latest v1 is locked)
      const generateResponse = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(409);

      expect(generateResponse.body.message).toContain("locked");
      expect(generateResponse.body.message).toContain("latest version");
    });

    it("should allow generation when older version is locked but latest is not", async () => {
      // Generate v1
      const v1Response = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      const v1DocId = v1Response.body._id;

      // Generate v2 (latest)
      const v2Response = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      // Lock v1 (older version, not latest)
      await documentModel.findByIdAndUpdate(v1DocId, {
        status: DocumentStatus.LOCKED,
        lockedBy: new Types.ObjectId(testUserId),
        lockedAt: new Date(),
      });

      // Verify v1 is locked
      const v1Doc = await documentModel.findById(v1DocId);
      expect(v1Doc?.status).toBe(DocumentStatus.LOCKED);

      // Verify v2 (latest) is not locked
      const v2Doc = await documentModel.findById(v2Response.body._id);
      expect(v2Doc?.status).toBe(DocumentStatus.GENERATED);

      // Should be able to generate v3 because latest (v2) is not locked
      const v3Response = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      expect(v3Response.body.version).toBe(3);
      expect(v3Response.body.status).toBe(DocumentStatus.GENERATED);
    });

    it("should forbid generation when shipment status is not DRAFT", async () => {
      // Generate a document
      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      // Transition to READY_FOR_FINANCE (this locks documents and changes status)
      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/readyForFinance`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Verify shipment status changed
      const shipment = await shipmentModel.findById(testShipmentId);
      expect(shipment?.status).toBe("READY_FOR_FINANCE");

      // Try to generate new document (should fail because status !== DRAFT)
      const generateResponse = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(409);

      expect(generateResponse.body.message).toContain("status");
      expect(generateResponse.body.message).toContain("READY_FOR_FINANCE");
    });

    it("should transition to READY_FOR_FINANCE and lock docs", async () => {
      // Generate required document
      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      // Transition to READY_FOR_FINANCE
      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/readyForFinance`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Verify shipment status
      const shipment = await shipmentModel.findById(testShipmentId);
      expect(shipment?.status).toBe("READY_FOR_FINANCE");

      // Verify document is locked
      const document = await documentModel.findOne({
        shipmentId: new Types.ObjectId(testShipmentId),
        documentType: DocumentType.BL,
      });
      expect(document?.status).toBe(DocumentStatus.LOCKED);
      expect(document?.lockedBy).toBeDefined();

      // Try to generate again (should fail)
      await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(409);
    });

    it("should get documents list with required types and downloadUrl", async () => {
      // Generate a document
      const generateResponse = await request(app.getHttpServer())
        .post(`/shipments/${testShipmentId}/documents/${DocumentType.BL}/generate`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/shipments/${testShipmentId}/documents`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.documents).toBeDefined();
      expect(Array.isArray(response.body.documents)).toBe(true);
      expect(response.body.requiredDocumentTypes).toBeDefined();
      expect(response.body.requiredDocumentTypes).toContain(DocumentType.BL);

      // Verify downloadUrl is present in each document
      expect(response.body.documents.length).toBeGreaterThan(0);
      response.body.documents.forEach((doc: any) => {
        expect(doc.downloadUrl).toBeDefined();
        expect(doc.downloadUrl).toContain(`/shipments/${testShipmentId}/documents/${doc.documentType}/download`);
        expect(doc.downloadUrl).toContain(`version=${doc.version}`);
      });

      // Test that the downloadUrl from the list actually works
      const firstDoc = response.body.documents[0];
      const downloadResponse = await request(app.getHttpServer())
        .get(firstDoc.downloadUrl)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(downloadResponse.headers["content-type"]).toContain("application/pdf");
      expect(downloadResponse.body.length).toBeGreaterThan(0);
    });
  });

  describe("LAND Mode Documents", () => {
    let landShipmentId: string;

    beforeEach(async () => {
      const shipmentData = {
        companyId: new Types.ObjectId(testCompanyId),
        officeId: new Types.ObjectId(testOfficeId),
        mode: ShipmentMode.LAND,
        incoterm: "EXW",
        movementType: "LAND",
        parties: {
          shipper: {
            name: "Test Shipper",
            address: "123 Shipper St",
            contact: "shipper@test.com",
          },
          consignee: {
            name: "Test Consignee",
            address: "456 Consignee Ave",
            contact: "consignee@test.com",
          },
        },
        cargo: {
          containers: [],
          packagesQuantity: 20,
          packagesType: "PALLETS",
          goodsDescription: "Land Cargo",
          grossWeightKg: 3000,
          netWeightKg: 2800,
        },
        transport: {
          land: {
            cartaPorteNumber: "CP123456",
            manifestNumber: "MF789012",
            documentDate: new Date(),
            placeOfLoading: "Warehouse A",
            placeOfUnloading: "Warehouse B",
            driverName: "John Driver",
            driverLicense: "DL123456",
            truckPlate: "TRUCK001",
            trailerPlate: "TRAILER001",
            destinationCountry: "USA",
            destinationWarehouse: "Warehouse B",
            customsExit: "Customs Exit",
            customsEntry: "Customs Entry",
            exportInvoiceNumber: "INV123",
            freightPayment: "PREPAID",
          },
        },
        operationalUserId: new Types.ObjectId(testUserId),
        createdBy: new Types.ObjectId(testUserId),
      };

      const shipment = await shipmentModel.create(shipmentData);
      landShipmentId = shipment._id.toString();
    });

    afterEach(async () => {
      if (landShipmentId) {
        await documentModel.deleteMany({
          shipmentId: new Types.ObjectId(landShipmentId),
        });
        await shipmentModel.findByIdAndDelete(landShipmentId);
      }
    });

    it("should generate CARTA_PORTE and MANIFIESTO_CARGA for LAND mode", async () => {
      // Generate CARTA_PORTE
      const cartaPorteResponse = await request(app.getHttpServer())
        .post(
          `/shipments/${landShipmentId}/documents/${DocumentType.CARTA_PORTE}/generate`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      expect(cartaPorteResponse.body.documentType).toBe(DocumentType.CARTA_PORTE);
      // Verify downloadUrl is present
      expect(cartaPorteResponse.body.downloadUrl).toBeDefined();
      expect(cartaPorteResponse.body.downloadUrl).toContain(`/shipments/${landShipmentId}/documents/${DocumentType.CARTA_PORTE}/download`);

      // Generate MANIFIESTO_CARGA
      const manifestResponse = await request(app.getHttpServer())
        .post(
          `/shipments/${landShipmentId}/documents/${DocumentType.MANIFIESTO_CARGA}/generate`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      expect(manifestResponse.body.documentType).toBe(
        DocumentType.MANIFIESTO_CARGA,
      );
      // Verify downloadUrl is present
      expect(manifestResponse.body.downloadUrl).toBeDefined();
      expect(manifestResponse.body.downloadUrl).toContain(`/shipments/${landShipmentId}/documents/${DocumentType.MANIFIESTO_CARGA}/download`);
    });

    it("should transition to READY_FOR_FINANCE with both required docs", async () => {
      // Generate both required documents
      await request(app.getHttpServer())
        .post(
          `/shipments/${landShipmentId}/documents/${DocumentType.CARTA_PORTE}/generate`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(
          `/shipments/${landShipmentId}/documents/${DocumentType.MANIFIESTO_CARGA}/generate`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      // Transition
      await request(app.getHttpServer())
        .post(`/shipments/${landShipmentId}/readyForFinance`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Verify both documents are locked
      const docs = await documentModel.find({
        shipmentId: new Types.ObjectId(landShipmentId),
      });

      expect(docs.length).toBe(2);
      docs.forEach((doc) => {
        expect(doc.status).toBe(DocumentStatus.LOCKED);
      });
    });
  });

  describe("AIR Mode Documents", () => {
    let airShipmentId: string;

    beforeEach(async () => {
      const shipmentData = {
        companyId: new Types.ObjectId(testCompanyId),
        officeId: new Types.ObjectId(testOfficeId),
        mode: ShipmentMode.AIR,
        incoterm: "FOB",
        movementType: "AIR",
        parties: {
          shipper: {
            name: "Test Shipper",
            address: "123 Shipper St",
            contact: "shipper@test.com",
          },
          consignee: {
            name: "Test Consignee",
            address: "456 Consignee Ave",
            contact: "consignee@test.com",
          },
        },
        cargo: {
          containers: [],
          packagesQuantity: 5,
          packagesType: "BOXES",
          goodsDescription: "Air Cargo",
          grossWeightKg: 100,
          airDimensionsText: "120x80x100 cm",
        },
        transport: {
          air: {
            hawbNumber: "HAWB123456",
            airportOfDeparture: "LAX",
            airportOfDestination: "JFK",
            firstCarrier: "Carrier ABC",
            routing: ["LAX", "JFK"],
            requestedFlight: "AA123",
            requestedFlightDate: new Date(),
            currency: "USD",
            chargesCode: "PP",
            declaredValueCarriage: 5000,
            declaredValueCustoms: 5000,
            insuranceAmount: 1000,
            paymentTerm: "PREPAID",
          },
        },
        operationalUserId: new Types.ObjectId(testUserId),
        createdBy: new Types.ObjectId(testUserId),
      };

      const shipment = await shipmentModel.create(shipmentData);
      airShipmentId = shipment._id.toString();
    });

    afterEach(async () => {
      if (airShipmentId) {
        await documentModel.deleteMany({
          shipmentId: new Types.ObjectId(airShipmentId),
        });
        await shipmentModel.findByIdAndDelete(airShipmentId);
      }
    });

    it("should generate HAWB for AIR mode", async () => {
      const response = await request(app.getHttpServer())
        .post(
          `/shipments/${airShipmentId}/documents/${DocumentType.HAWB}/generate`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.documentType).toBe(DocumentType.HAWB);
      expect(response.body.status).toBe(DocumentStatus.GENERATED);
      // Verify downloadUrl is present
      expect(response.body.downloadUrl).toBeDefined();
      expect(response.body.downloadUrl).toContain(`/shipments/${airShipmentId}/documents/${DocumentType.HAWB}/download`);
    });
  });
});
