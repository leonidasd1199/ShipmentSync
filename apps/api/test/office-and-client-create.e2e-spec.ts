import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";
import { getModelToken } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Office, OfficeDocument } from "../src/schemas/office.schema";
import { Client, ClientDocument } from "../src/schemas/client.schema";
import { MailService } from "../src/mail/mail.service";

const mailServiceMock = {
  sendEmail: jest.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendQuotationEmail: jest.fn().mockResolvedValue(undefined),
  sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
};

/**
 * E2E Tests for Office create (POST /offices) and Client create (POST /clients)
 * using the same test user as other API tests (john.doe@shipsync.com).
 *
 * Prerequisites:
 * - MongoDB running (e.g. MONGODB_URI=mongodb://localhost:27017/shipsync)
 * - Migrations applied (npm run mm:up from apps/api)
 * - Test user john.doe@shipsync.com with password123, ops_admin (or office:create + client:create)
 */
describe("Office and Client create (e2e)", () => {
  let app: INestApplication<App>;
  let authToken: string;
  let testCompanyId: string;
  let createdOfficeId: string | null = null;
  let createdClientId: string | null = null;

  let officeModel: Model<OfficeDocument>;
  let clientModel: Model<ClientDocument>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    officeModel = moduleFixture.get<Model<OfficeDocument>>(
      getModelToken(Office.name),
    );
    clientModel = moduleFixture.get<Model<ClientDocument>>(
      getModelToken(Client.name),
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
  }, 30000);

  afterAll(async () => {
    if (clientModel && createdClientId) {
      await clientModel.findByIdAndDelete(createdClientId).exec();
    }
    if (officeModel && createdOfficeId) {
      await officeModel.findByIdAndDelete(createdOfficeId).exec();
    }
    if (app) {
      await app.close();
    }
  });

  describe("POST /offices (office create)", () => {
    it("returns 401 without auth", async () => {
      await request(app.getHttpServer())
        .post("/offices")
        .send({
          name: "E2E Test Office",
          companyId: testCompanyId,
        })
        .expect(401);
    });

    it("creates an office with valid name and companyId (john.doe)", async () => {
      const res = await request(app.getHttpServer())
        .post("/offices")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "E2E Office Create Test",
          companyId: testCompanyId,
          type: "branch",
        })
        .expect(201);

      const officeId = res.body._id ?? res.body.id;
      expect(officeId).toBeDefined();
      expect(res.body.name).toBe("E2E Office Create Test");
      expect(res.body.company || res.body.companyId).toBeDefined();

      createdOfficeId = officeId;
    });
  });

  describe("POST /clients (client create)", () => {
    let officeIdForClient: string;

    beforeAll(async () => {
      if (createdOfficeId) {
        officeIdForClient = createdOfficeId;
        return;
      }
      const officesRes = await request(app.getHttpServer())
        .get("/offices")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);
      const offices = Array.isArray(officesRes.body) ? officesRes.body : [];
      if (!offices.length) {
        throw new Error("No office available for client create test");
      }
      officeIdForClient = offices[0]._id ?? offices[0].id;
    });

    it("returns 401 without auth", async () => {
      await request(app.getHttpServer())
        .post("/clients")
        .send({
          name: "E2E Test Client",
          officeId: officeIdForClient,
          email: "e2e.office-client-create.unauth@test.example.com",
        })
        .expect(401);
    });

    it("creates a client with valid name and officeId (john.doe)", async () => {
      const res = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "E2E Client Create Test",
          officeId: officeIdForClient,
          email: "e2e.office-client-create@test.example.com",
          contactPerson: "Test Contact",
        })
        .expect(201);

      const clientId = res.body._id ?? res.body.id;
      expect(clientId).toBeDefined();
      expect(res.body.name).toBe("E2E Client Create Test");
      expect(res.body.office).toBeDefined();

      createdClientId = clientId;
    });
  });
});
