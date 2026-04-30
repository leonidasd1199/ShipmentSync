import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";
import { getModelToken } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  QuotationDelivery,
  QuotationDeliveryDocument,
} from "../src/schemas/quotation-delivery.schema";
import { Quotation, QuotationDocument } from "../src/schemas/quotation.schema";
import { AgentPricelist, AgentPricelistDocument } from "../src/schemas/agent-pricelist.schema";
import { MailService } from "../src/mail/mail.service";

const mailServiceMock = {
  sendEmail: jest.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendQuotationEmail: jest.fn().mockResolvedValue(undefined),
  sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
};

/**
 * E2E Tests for Quotation Deliveries (quotation_deliveries collection).
 *
 * QuotationDelivery records are created only when POST /pricing/send-to-clients
 * is called with quotationId (not when creating/updating a quotation with status "sent").
 *
 * Verifies:
 * - A QuotationDelivery is created when send-to-clients is called with quotationId
 * - No duplicate delivery when same snapshot is sent again
 * - A second delivery when snapshot changed and send-to-clients called again
 * - No delivery when quotation is never sent via send-to-clients
 *
 * Prerequisites: MongoDB running, migrations applied (including
 * 20260310180000-create-quotation-deliveries-collection.js).
 */
describe("Quotation Deliveries (e2e)", () => {
  let app: INestApplication<App>;
  let authToken: string;
  let testCompanyId: string;
  let testClientId: string;
  let testShippingLineId: string;
  let secondTestClientId: string;

  let quotationModel: Model<QuotationDocument>;
  let deliveryModel: Model<QuotationDeliveryDocument>;
  let pricelistModel: Model<AgentPricelistDocument>;

  const createdQuotationIds: string[] = [];
  const createdDeliveryQuotationIds: string[] = [];
  const createdPricelistIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    quotationModel = moduleFixture.get<Model<QuotationDocument>>(
      getModelToken(Quotation.name),
    );
    deliveryModel = moduleFixture.get<Model<QuotationDeliveryDocument>>(
      getModelToken(QuotationDelivery.name),
    );
    pricelistModel = moduleFixture.get<Model<AgentPricelistDocument>>(
      getModelToken(AgentPricelist.name),
    );

    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "john.doe@shipsync.com",
        password: "password123",
      });

    if (loginResponse.status !== 200) {
      throw new Error(
        `Failed to login: ${JSON.stringify(loginResponse.body)}`,
      );
    }
    authToken = loginResponse.body.access_token;
    testCompanyId =
      loginResponse.body.user.company?.id ||
      loginResponse.body.user.company ||
      loginResponse.body.user.companyId;
    if (!testCompanyId) {
      throw new Error("Login response missing companyId");
    }

    const [clientsRes, shippingRes] = await Promise.all([
      request(app.getHttpServer())
        .get("/quotations/helpers/clients")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200),
      request(app.getHttpServer())
        .get("/quotations/helpers/shipping-lines")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200),
    ]);

    if (clientsRes.body.length > 1 && shippingRes.body.length > 0) {
      testClientId = clientsRes.body[0]._id ?? clientsRes.body[0].id;
      secondTestClientId = clientsRes.body[1]._id ?? clientsRes.body[1].id;
      testShippingLineId =
        shippingRes.body[0]._id ?? shippingRes.body[0].id;
    } else {
      throw new Error(
        "Need at least two clients and one shipping line. Run migrations and seed data.",
      );
    }
  }, 60000); // MongoDB connection and helpers

  afterAll(async () => {
    for (const id of createdQuotationIds) {
      try {
        await quotationModel.findByIdAndDelete(id).exec();
      } catch {
        // ignore
      }
    }
    for (const id of createdDeliveryQuotationIds) {
      try {
        await deliveryModel
          .deleteMany({ quotationId: new Types.ObjectId(id) })
          .exec();
      } catch {
        // ignore
      }
    }
    for (const id of createdPricelistIds) {
      try {
        await pricelistModel.findByIdAndDelete(id).exec();
      } catch {
        // ignore
      }
    }
    if (app) {
      await app.close();
    }
  });

  function validUntil() {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  describe("POST /pricing/send-to-clients with quotationId", () => {
    it("should create a QuotationDelivery when send-to-clients is called with quotationId", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/quotations")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          serviceType: "LCL",
          incoterm: "EXW",
          clientId: testClientId,
          companyId: testCompanyId,
          shippingLineId: testShippingLineId,
          validUntil: validUntil(),
          legacyItems: [
            {
              type: "cargo",
              description: "E2E Delivery Cargo",
              price: 1000,
              transitType: "maritime",
            },
          ],
          summarize: true,
          status: "draft",
          notes: "E2E quotation delivery test - send via pricing",
        });

      expect(createRes.status).toBe(201);
      const quotationId = createRes.body._id ?? createRes.body.id;
      expect(quotationId).toBeDefined();
      createdQuotationIds.push(quotationId);
      createdDeliveryQuotationIds.push(quotationId);

      const deliveryBefore = await deliveryModel
        .findOne({ quotationId: new Types.ObjectId(quotationId) })
        .lean()
        .exec();
      expect(deliveryBefore).toBeNull();

      const sendRes = await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ quotationId, sendToAll: false });

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.success).toBe(true);
      expect(sendRes.body.message).toBe("Quotation sent to client");
      expect(sendRes.body.quotationId).toBe(quotationId);
      expect(sendRes.body.clientId).toBeDefined();
      expect(sendRes.body.sentAt).toBeDefined();

      const quotationAfter = await quotationModel
        .findById(quotationId)
        .select("status")
        .lean()
        .exec();
      expect(quotationAfter?.status).toBe("sent");

      const delivery = await deliveryModel
        .findOne({ quotationId: new Types.ObjectId(quotationId) })
        .lean()
        .exec();
      expect(delivery).not.toBeNull();
      expect(delivery!.quotationId.toString()).toBe(
        typeof quotationId === "string" ? quotationId : quotationId.toString(),
      );
      expect(delivery!.clientId).toBeDefined();
      expect(delivery!.companyId).toBeDefined();
      expect(delivery!.sentBy).toBeDefined();
      expect(delivery!.sentAt).toBeDefined();
      expect(delivery!.isActive).toBe(true);

      const snapshot = delivery!.quotationSnapshot as Record<string, unknown>;
      expect(snapshot).toBeDefined();
      expect(snapshot._id).toBeDefined();
      expect(snapshot.clientId).toBeDefined();
      expect(snapshot.companyId).toBeDefined();
      expect((snapshot as any).legacyItems).toBeDefined();
      expect(Array.isArray((snapshot as any).legacyItems)).toBe(true);
    });
  });

  describe("POST /pricing/send-to-clients pricelist flow with quotationId (canonical)", () => {
    it("should create deliveries for multiple clients referencing the original quotationId (no placeholder quotations)", async () => {
      // Create a canonical quotation (as Create Quote screen would)
      const createRes = await request(app.getHttpServer())
        .post("/quotations")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          serviceType: "FCL",
          incoterm: "DDP",
          clientId: testClientId,
          companyId: testCompanyId,
          shippingLineId: testShippingLineId,
          validUntil: validUntil(),
          legacyItems: [
            { type: "cargo", description: "Item A", price: 100 },
            { type: "cargo", description: "Item B", price: 200 },
          ],
          summarize: false,
          status: "draft",
        });
      expect(createRes.status).toBe(201);
      const quotationId = createRes.body._id ?? createRes.body.id;
      createdQuotationIds.push(quotationId);
      createdDeliveryQuotationIds.push(quotationId);

      // Create an approved pricelist (needed for endpoint validation)
      const pricelist = await pricelistModel.create({
        supplierId: new Types.ObjectId(testShippingLineId),
        status: "approved",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      createdPricelistIds.push(pricelist._id.toString());

      const pdfBuffer = Buffer.from("%PDF-1.4\n% test pdf\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");

      const quoteSnapshot = {
        legacyItems: [
          { type: "cargo", description: "Snapshot Item A", price: 111 },
          { type: "cargo", description: "Snapshot Item B", price: 222 },
          { type: "cargo", description: "Snapshot Item C", price: 333 },
        ],
        total: 666,
        validUntil: validUntil(),
      };

      const sendRes = await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${authToken}`)
        .field("quotationId", quotationId)
        .field("pricelistId", pricelist._id.toString())
        .field("sendToAll", "false")
        .field("clientIds", testClientId)
        .field("clientIds", secondTestClientId)
        .field("quoteSnapshot", JSON.stringify(quoteSnapshot))
        .field("quoteSnapshotLegacyItems", JSON.stringify(quoteSnapshot.legacyItems))
        .attach("pdf", pdfBuffer, { filename: "test.pdf", contentType: "application/pdf" });

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.success).toBe(true);

      // Two deliveries, both referencing the SAME canonical quotationId
      const deliveries = await deliveryModel
        .find({ quotationId: new Types.ObjectId(quotationId) })
        .lean()
        .exec();
      expect(deliveries.length).toBe(2);
      const clientIds = deliveries.map((d) => d.clientId.toString()).sort();
      expect(clientIds).toEqual([testClientId, secondTestClientId].sort());

      for (const d of deliveries) {
        const snap: any = d.quotationSnapshot;
        expect(Array.isArray(snap.legacyItems)).toBe(true);
        expect(snap.legacyItems.length).toBe(3);
        expect(snap.total).toBe(666);
      }
    });
  });

  describe("POST /pricing/send-to-clients with quotationId - errors", () => {
    it("should return 404 when quotationId does not exist", async () => {
      const fakeId = new Types.ObjectId();
      const sendRes = await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ quotationId: fakeId.toString(), sendToAll: false });

      expect(sendRes.status).toBe(404);
    });
  });

  describe("no delivery without send-to-clients", () => {
    it("should not create a QuotationDelivery when quotation is created as draft and never sent", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/quotations")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          serviceType: "LCL",
          incoterm: "EXW",
          clientId: testClientId,
          companyId: testCompanyId,
          shippingLineId: testShippingLineId,
          validUntil: validUntil(),
          legacyItems: [
            { type: "cargo", description: "Draft only", price: 500, transitType: "maritime" },
          ],
          summarize: true,
          status: "draft",
          notes: "E2E no delivery for draft",
        });

      expect(createRes.status).toBe(201);
      const quotationId = createRes.body._id ?? createRes.body.id;
      createdQuotationIds.push(quotationId);

      const delivery = await deliveryModel
        .findOne({ quotationId: new Types.ObjectId(quotationId) })
        .lean()
        .exec();
      expect(delivery).toBeNull();
    });
  });

  describe("send-to-clients after creating quotation", () => {
    it("should create a QuotationDelivery when send-to-clients is called for a draft quotation", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/quotations")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          serviceType: "LCL",
          incoterm: "FOB",
          clientId: testClientId,
          companyId: testCompanyId,
          shippingLineId: testShippingLineId,
          validUntil: validUntil(),
          legacyItems: [
            {
              type: "cargo",
              description: "E2E Update to sent",
              price: 750,
              transitType: "maritime",
            },
          ],
          summarize: true,
          status: "draft",
          notes: "E2E update to sent",
        });

      expect(createRes.status).toBe(201);
      const quotationId = createRes.body._id ?? createRes.body.id;
      createdQuotationIds.push(quotationId);
      createdDeliveryQuotationIds.push(quotationId);

      const deliveryBefore = await deliveryModel
        .findOne({ quotationId: new Types.ObjectId(quotationId) })
        .lean()
        .exec();
      expect(deliveryBefore).toBeNull();

      const sendRes = await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ quotationId, sendToAll: false });

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.success).toBe(true);
      expect(sendRes.body.quotationId).toBe(quotationId);

      const delivery = await deliveryModel
        .findOne({ quotationId: new Types.ObjectId(quotationId) })
        .lean()
        .exec();
      expect(delivery).not.toBeNull();
      expect(delivery!.quotationId.toString()).toBe(
        typeof quotationId === "string" ? quotationId : quotationId.toString(),
      );
      const snapshot = delivery!.quotationSnapshot as Record<string, unknown>;
      expect(snapshot).toBeDefined();
    });
  });

  describe("duplicate prevention (snapshot-based)", () => {
    it("should not create a second QuotationDelivery when same quotation is sent again with identical snapshot", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/quotations")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          serviceType: "LCL",
          incoterm: "CIF",
          clientId: testClientId,
          companyId: testCompanyId,
          shippingLineId: testShippingLineId,
          validUntil: validUntil(),
          legacyItems: [
            {
              type: "cargo",
              description: "E2E Same snapshot",
              price: 999,
              transitType: "maritime",
            },
          ],
          summarize: true,
          status: "draft",
          notes: "E2E duplicate prevention",
        });

      expect(createRes.status).toBe(201);
      const quotationId = createRes.body._id ?? createRes.body.id;
      createdQuotationIds.push(quotationId);
      createdDeliveryQuotationIds.push(quotationId);

      await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ quotationId, sendToAll: false })
        .expect(200);

      const countAfterFirst = await deliveryModel
        .countDocuments({ quotationId: new Types.ObjectId(quotationId) })
        .exec();
      expect(countAfterFirst).toBe(1);

      await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ quotationId, sendToAll: false })
        .expect(200);

      const countAfterSecond = await deliveryModel
        .countDocuments({ quotationId: new Types.ObjectId(quotationId) })
        .exec();
      expect(countAfterSecond).toBe(1);
    });

    it("should create a second QuotationDelivery when same quotation is sent again with changed snapshot", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/quotations")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          serviceType: "LCL",
          incoterm: "DDP",
          clientId: testClientId,
          companyId: testCompanyId,
          shippingLineId: testShippingLineId,
          validUntil: validUntil(),
          legacyItems: [
            {
              type: "cargo",
              description: "E2E Changed snapshot",
              price: 100,
              transitType: "maritime",
            },
          ],
          summarize: true,
          status: "draft",
          notes: "First send",
        });

      expect(createRes.status).toBe(201);
      const quotationId = createRes.body._id ?? createRes.body.id;
      createdQuotationIds.push(quotationId);
      createdDeliveryQuotationIds.push(quotationId);

      await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ quotationId, sendToAll: false })
        .expect(200);

      const countAfterFirst = await deliveryModel
        .countDocuments({ quotationId: new Types.ObjectId(quotationId) })
        .exec();
      expect(countAfterFirst).toBe(1);

      await request(app.getHttpServer())
        .put(`/quotations/${quotationId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ notes: "Second send - notes changed" })
        .expect(200);

      await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ quotationId, sendToAll: false })
        .expect(200);

      const countAfterSecond = await deliveryModel
        .countDocuments({ quotationId: new Types.ObjectId(quotationId) })
        .exec();
      expect(countAfterSecond).toBe(2);
    });
  });
});
