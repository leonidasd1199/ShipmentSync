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
import {
  AgentPricelist,
  AgentPricelistDocument,
} from "../src/schemas/agent-pricelist.schema";
import { MailService } from "../src/mail/mail.service";

const mailServiceMock = {
  sendEmail: jest.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendQuotationEmail: jest.fn().mockResolvedValue(undefined),
  sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
};

/**
 * E2E-style Tests for Quotation Deliveries (quotation_deliveries collection).
 *
 * These run under Jest's normal testMatch (test folder + *.spec.ts).
 */
describe("Quotation Deliveries (e2e-style)", () => {
  let app: INestApplication<App>;
  let authToken: string;
  let testCompanyId: string;
  let testClientId: string;
  let secondTestClientId: string;
  let testShippingLineId: string;

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
      testShippingLineId = shippingRes.body[0]._id ?? shippingRes.body[0].id;
    } else {
      throw new Error(
        "Need at least two clients and one shipping line. Run migrations and seed data.",
      );
    }
  }, 60000);

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
    if (app) await app.close();
  });

  function validUntil() {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  it("creates a QuotationDelivery when send-to-clients is called with quotationId (quotation-only flow)", async () => {
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

    const delivery = await deliveryModel
      .findOne({ quotationId: new Types.ObjectId(quotationId) })
      .lean()
      .exec();
    expect(delivery).not.toBeNull();
  });

  it("pricelist flow reuses canonical quotationId and creates deliveries per client", async () => {
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

    const pricelist = await pricelistModel.create({
      supplierId: new Types.ObjectId(testShippingLineId),
      status: "approved",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    createdPricelistIds.push(pricelist._id.toString());

    const pdfBuffer = Buffer.from(
      "%PDF-1.4\n% test pdf\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF",
    );

    const quoteSnapshot = {
      legacyItems: [
        { type: "cargo", description: "Snapshot Item A", price: 111 },
        { type: "cargo", description: "Snapshot Item B", price: 222 },
        { type: "cargo", description: "Snapshot Item C", price: 333 },
      ],
      total: 666,
      validUntil: validUntil(),
    };

    await request(app.getHttpServer())
      .post("/pricing/send-to-clients")
      .set("Authorization", `Bearer ${authToken}`)
      .field("quotationId", quotationId)
      .field("pricelistId", pricelist._id.toString())
      .field("sendToAll", "false")
      .field("clientIds", testClientId)
      .field("clientIds", secondTestClientId)
      .field("quoteSnapshot", JSON.stringify(quoteSnapshot))
      .field(
        "quoteSnapshotLegacyItems",
        JSON.stringify(quoteSnapshot.legacyItems),
      )
      .attach("pdf", pdfBuffer, {
        filename: "test.pdf",
        contentType: "application/pdf",
      })
      .expect(200);

    const deliveries = await deliveryModel
      .find({ quotationId: new Types.ObjectId(quotationId) })
      .lean()
      .exec();
    expect(deliveries.length).toBe(2);
    for (const d of deliveries) {
      const snap: any = d.quotationSnapshot;
      expect(Array.isArray(snap.legacyItems)).toBe(true);
      expect(snap.legacyItems.length).toBe(3);
      expect(snap.total).toBe(666);
    }
  });

  it("pricelist flow preserves full legacyItems from canonical when no quoteSnapshot payload", async () => {
    const threeItems = [
      { type: "cargo" as const, description: "Canon A", price: 10 },
      { type: "cargo" as const, description: "Canon B", price: 20 },
      { type: "cargo" as const, description: "Canon C", price: 30 },
    ];
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
        legacyItems: threeItems,
        summarize: false,
        status: "draft",
      });
    expect(createRes.status).toBe(201);
    const quotationId = createRes.body._id ?? createRes.body.id;
    createdQuotationIds.push(quotationId);
    createdDeliveryQuotationIds.push(quotationId);

    const pricelist = await pricelistModel.create({
      supplierId: new Types.ObjectId(testShippingLineId),
      status: "approved",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    createdPricelistIds.push(pricelist._id.toString());

    const pdfBuffer = Buffer.from(
      "%PDF-1.4\n% test pdf\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF",
    );

    await request(app.getHttpServer())
      .post("/pricing/send-to-clients")
      .set("Authorization", `Bearer ${authToken}`)
      .field("quotationId", quotationId)
      .field("pricelistId", pricelist._id.toString())
      .field("sendToAll", "false")
      .field("clientIds", testClientId)
      .field("clientIds", secondTestClientId)
      .attach("pdf", pdfBuffer, {
        filename: "test.pdf",
        contentType: "application/pdf",
      })
      .expect(200);

    const deliveries = await deliveryModel
      .find({ quotationId: new Types.ObjectId(quotationId) })
      .lean()
      .exec();
    expect(deliveries.length).toBe(2);
    for (const d of deliveries) {
      const snap: any = d.quotationSnapshot;
      expect(Array.isArray(snap.legacyItems)).toBe(true);
      expect(snap.legacyItems.length).toBe(3);
      expect(snap.legacyItems.map((i: any) => i.description).sort()).toEqual([
        "Canon A",
        "Canon B",
        "Canon C",
      ]);
    }
  });
});

