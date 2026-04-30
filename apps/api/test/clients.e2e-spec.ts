import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";
import { getModelToken } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument } from "../src/schemas/user.schema";
import { Client, ClientDocument } from "../src/schemas/client.schema";
import { Office, OfficeDocument } from "../src/schemas/office.schema";
import { Role, RoleDocument } from "../src/schemas/role.schema";
import {
  PermissionModel,
  PermissionDocument,
} from "../src/schemas/permission.schema";
import {
  QuotationDelivery,
  QuotationDeliveryDocument,
} from "../src/schemas/quotation-delivery.schema";
import { Shipment, ShipmentDocument } from "../src/schemas/shipment.schema";
import { ShipmentStatus } from "../src/schemas/shipment.schema";
import { MailService } from "../src/mail/mail.service";
import { History, HistoryDocument } from "../src/schemas/history.schema";
import * as bcrypt from "bcryptjs";

const mailServiceMock = {
  sendEmail: jest.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendQuotationEmail: jest.fn().mockResolvedValue(undefined),
  sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
};

/**
 * E2E Tests for Clients API and client-role isolation
 *
 * Prerequisites:
 * - MongoDB must be running and reachable. If beforeAll times out, the app is waiting on MongoDB:
 *   start MongoDB (e.g. docker-compose up -d mongo) and, if not using Docker, set
 *   MONGODB_URI=mongodb://localhost:27017/shipsync (app default is mongodb://mongo:27017/shipsync).
 * - Run migrations (npm run mm:up from apps/api):
 *   - 20260310120000-add-client-role-permissions-and-user-client-ref.js (client-role users)
 *   - 20260310150000-assign-client-permissions-to-ops-admin.js (operator needs client:* and office:*)
 *
 * The test creates a second office via POST /offices, then two clients (one per office),
 * and two client-role users each linked to one client. This verifies that each client
 * user sees only their own client and cannot access the other.
 */
describe("Clients (e2e)", () => {
  let app: INestApplication<App>;
  let operatorToken: string;
  let operatorUserId: string;
  let office1Id: string;
  let office2Id: string;
  let companyId: string;
  let client1Id: string;
  let client2Id: string;
  let clientUser1Id: string;
  let clientUser2Id: string;
  let clientUser1Email: string;
  let clientUser2Email: string;
  const clientUser1Password = "client1pass";
  const clientUser2Password = "client2pass";

  let clientWelcomeId: string | null = null;
  let userWelcomeEmail: string | null = null;
  let clientTempPasswordOnceId: string | null = null;
  let userTempPasswordOnceEmail: string | null = null;

  let userModel: Model<UserDocument>;
  let clientModel: Model<ClientDocument>;
  let officeModel: Model<OfficeDocument>;
  let roleModel: Model<RoleDocument>;
  let permissionModel: Model<PermissionDocument>;
  let quotationDeliveryModel: Model<QuotationDeliveryDocument>;
  let shipmentModel: Model<ShipmentDocument>;
  let historyModel: Model<HistoryDocument>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userModel = moduleFixture.get<Model<UserDocument>>(getModelToken(User.name));
    clientModel = moduleFixture.get<Model<ClientDocument>>(
      getModelToken(Client.name),
    );
    officeModel = moduleFixture.get<Model<OfficeDocument>>(
      getModelToken(Office.name),
    );
    roleModel = moduleFixture.get<Model<RoleDocument>>(getModelToken(Role.name));
    permissionModel = moduleFixture.get<Model<PermissionDocument>>(
      getModelToken(PermissionModel.name),
    );
    quotationDeliveryModel = moduleFixture.get<Model<QuotationDeliveryDocument>>(
      getModelToken(QuotationDelivery.name),
    );
    shipmentModel = moduleFixture.get<Model<ShipmentDocument>>(
      getModelToken(Shipment.name),
    );
    historyModel = moduleFixture.get<Model<HistoryDocument>>(
      getModelToken(History.name),
    );

    // Login as operator (ops_admin) to create clients and get offices
    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "john.doe@shipsync.com",
        password: "password123",
      });

    if (loginResponse.status !== 200) {
      throw new Error(
        `Failed to login operator: ${JSON.stringify(loginResponse.body)}`,
      );
    }
    operatorToken = loginResponse.body.access_token;
    operatorUserId =
      loginResponse.body.user.id ??
      loginResponse.body.user._id;
    companyId =
      loginResponse.body.user.company?.id ||
      loginResponse.body.user.company ||
      loginResponse.body.user.companyId;
    if (!companyId) {
      throw new Error("Login response missing companyId");
    }

    // Get first office for the operator's company
    const officesResponse = await request(app.getHttpServer())
      .get("/offices")
      .set("Authorization", `Bearer ${operatorToken}`)
      .expect(200);

    const offices = Array.isArray(officesResponse.body)
      ? officesResponse.body
      : officesResponse.body?.data ?? [];
    if (!offices.length) {
      throw new Error(
        "Need at least 1 office for the test. Ensure seed data has offices for the operator company.",
      );
    }
    office1Id = offices[0].id ?? offices[0]._id;

    // Create a second office so we have two distinct offices (stronger isolation test)
    const createOfficeRes = await request(app.getHttpServer())
      .post("/offices")
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({
        name: "E2E Isolation Office 2",
        companyId,
        type: "branch",
      });
    if (createOfficeRes.status !== 201) {
      if (createOfficeRes.status === 403) {
        throw new Error(
          "Operator missing office:create. Run migrations: cd apps/api && npm run mm:up.",
        );
      }
      throw new Error(
        `Failed to create office: ${createOfficeRes.status} ${JSON.stringify(createOfficeRes.body)}`,
      );
    }
    office2Id = createOfficeRes.body._id ?? createOfficeRes.body.id;

    // Assign the operator to the new office (via DB) so they can see clients in it when listing
    await userModel.findByIdAndUpdate(operatorUserId, {
      $addToSet: { offices: new Types.ObjectId(office2Id) },
    });

    // Create two clients, one per office (seeded directly for stable test setup)
    const [seedClient1, seedClient2] = await clientModel.create([
      {
        name: "E2E Client One",
        office: new Types.ObjectId(office1Id),
        isActive: true,
      },
      {
        name: "E2E Client Two",
        office: new Types.ObjectId(office2Id),
        isActive: true,
      },
    ]);
    client1Id = seedClient1._id.toString();
    client2Id = seedClient2._id.toString();

    // Ensure role "client" and permissions client:read, client:list exist (create if missing)
    let clientRole = await roleModel.findOne({ code: "client" }).exec();
    if (!clientRole) {
      const [created] = await roleModel.create([
        { code: "client", name: "Client", description: "Client role" },
      ]);
      clientRole = created;
    }

    let readPerm = await permissionModel.findOne({ code: "client:read" }).exec();
    let listPerm = await permissionModel.findOne({ code: "client:list" }).exec();
    let updateOwnPerm = await permissionModel.findOne({ code: "client:update-own" }).exec();
    if (!readPerm || !listPerm) {
      const permsToCreate: Array<{
        code: string;
        name: string;
        description: string;
        category: string;
        isActive: boolean;
      }> = [];
      if (!readPerm) permsToCreate.push({ code: "client:read", name: "Read Client", description: "View client details", category: "client", isActive: true });
      if (!listPerm) permsToCreate.push({ code: "client:list", name: "List Clients", description: "View client listings", category: "client", isActive: true });
      await permissionModel.collection.insertMany(
        permsToCreate.map((p) => ({ ...p, createdAt: new Date(), updatedAt: new Date() })),
      );
      if (!readPerm) readPerm = (await permissionModel.findOne({ code: "client:read" }).exec())!;
      if (!listPerm) listPerm = (await permissionModel.findOne({ code: "client:list" }).exec())!;
    }
    if (!updateOwnPerm) {
      await permissionModel.collection.insertOne({
        code: "client:update-own",
        name: "Update Own Client",
        description: "Update own client information",
        category: "client",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      updateOwnPerm = (await permissionModel.findOne({ code: "client:update-own" }).exec())!;
    }
    const clientUserPerms = [readPerm._id, listPerm._id, updateOwnPerm._id];

    clientUser1Email = "clients.e2e.user1@test.shipsync.com";
    clientUser2Email = "clients.e2e.user2@test.shipsync.com";

    // Create two client-role users, each linked to one client
    const [user1, user2] = await Promise.all([
      userModel.create({
        firstName: "E2E",
        lastName: "ClientUser1",
        email: clientUser1Email,
        password: await bcrypt.hash(clientUser1Password, 10),
        roleCode: "client",
        role: clientRole._id,
        company: new Types.ObjectId(companyId),
        offices: [new Types.ObjectId(office1Id)],
        permissions: clientUserPerms,
        client: new Types.ObjectId(client1Id),
        isActive: true,
      }),
      userModel.create({
        firstName: "E2E",
        lastName: "ClientUser2",
        email: clientUser2Email,
        password: await bcrypt.hash(clientUser2Password, 10),
        roleCode: "client",
        role: clientRole._id,
        company: new Types.ObjectId(companyId),
        offices: [new Types.ObjectId(office2Id)],
        permissions: clientUserPerms,
        client: new Types.ObjectId(client2Id),
        isActive: true,
      }),
    ]);
    clientUser1Id = user1._id.toString();
    clientUser2Id = user2._id.toString();

    // Seed quotation_deliveries for price-list tests (different sentAt for date filtering)
    const quoteId = new Types.ObjectId();
    await quotationDeliveryModel.insertMany([
      {
        quotationId: quoteId,
        quotationSnapshot: { _id: quoteId, status: "sent", notes: "E2E Client One delivery 1" },
        clientId: new Types.ObjectId(client1Id),
        sentBy: new Types.ObjectId(operatorUserId),
        sentAt: new Date("2025-01-15T12:00:00Z"),
        companyId: new Types.ObjectId(companyId),
        officeId: new Types.ObjectId(office1Id),
        isActive: true,
      },
      {
        quotationId: new Types.ObjectId(),
        quotationSnapshot: { status: "sent", notes: "E2E Client One delivery 2" },
        clientId: new Types.ObjectId(client1Id),
        sentBy: new Types.ObjectId(operatorUserId),
        sentAt: new Date("2025-06-20T12:00:00Z"),
        companyId: new Types.ObjectId(companyId),
        officeId: new Types.ObjectId(office1Id),
        isActive: true,
      },
      {
        quotationId: new Types.ObjectId(),
        quotationSnapshot: { status: "sent", notes: "E2E Client Two delivery" },
        clientId: new Types.ObjectId(client2Id),
        sentBy: new Types.ObjectId(operatorUserId),
        sentAt: new Date("2025-03-10T12:00:00Z"),
        companyId: new Types.ObjectId(companyId),
        officeId: new Types.ObjectId(office2Id),
        isActive: true,
      },
    ]);

    // Seed shipments for client1 and client2 (minimal docs for getShipments tests)
    await shipmentModel.insertMany([
      {
        companyId: new Types.ObjectId(companyId),
        officeId: new Types.ObjectId(office1Id),
        mode: "OCEAN",
        incoterm: "FOB",
        movementType: "FCL",
        parties: {
          shipper: { clientId: new Types.ObjectId(client1Id), name: "E2E Client One" },
          consignee: { name: "Consignee A" },
        },
        cargo: { containers: [] },
        operationalUserId: new Types.ObjectId(operatorUserId),
        status: ShipmentStatus.DRAFT,
        createdBy: new Types.ObjectId(operatorUserId),
        createdAt: new Date("2025-02-01T00:00:00Z"),
      },
      {
        companyId: new Types.ObjectId(companyId),
        officeId: new Types.ObjectId(office2Id),
        mode: "OCEAN",
        incoterm: "FOB",
        movementType: "FCL",
        parties: {
          shipper: { name: "Shipper B" },
          consignee: { clientId: new Types.ObjectId(client2Id), name: "E2E Client Two" },
        },
        cargo: { containers: [] },
        operationalUserId: new Types.ObjectId(operatorUserId),
        status: ShipmentStatus.DRAFT,
        createdBy: new Types.ObjectId(operatorUserId),
        createdAt: new Date("2025-04-01T00:00:00Z"),
      },
    ]);
  }, 60000); // 60s: app init + MongoDB connection + login + create office/clients/users

  afterAll(async () => {
    if (quotationDeliveryModel && client1Id && client2Id) {
      await quotationDeliveryModel.deleteMany({
        clientId: { $in: [new Types.ObjectId(client1Id), new Types.ObjectId(client2Id)] },
      });
    }
    if (shipmentModel && client1Id && client2Id) {
      await shipmentModel.deleteMany({
        $or: [
          { "parties.shipper.clientId": { $in: [new Types.ObjectId(client1Id), new Types.ObjectId(client2Id)] } },
          { "parties.consignee.clientId": { $in: [new Types.ObjectId(client1Id), new Types.ObjectId(client2Id)] } },
        ],
      });
    }
    if (userModel) {
      const emailsToDelete = [clientUser1Email, clientUser2Email];
      if (userWelcomeEmail) emailsToDelete.push(userWelcomeEmail);
      if (userTempPasswordOnceEmail) emailsToDelete.push(userTempPasswordOnceEmail);
      await userModel.deleteMany({ email: { $in: emailsToDelete } });
    }
    if (clientModel && (client1Id || client2Id || clientWelcomeId || clientTempPasswordOnceId)) {
      const ids = [client1Id, client2Id, clientWelcomeId, clientTempPasswordOnceId].filter(Boolean) as string[];
      await clientModel.deleteMany({
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
      });
    }
    if (officeModel && office2Id) {
      await officeModel.findByIdAndDelete(office2Id);
    }
    if (app) {
      await app.close();
    }
  });

  describe("Client isolation (client-role users cannot see other clients)", () => {
    it("client user 1 sees only their client in GET /clients", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);

      const token = loginRes.body.access_token;
      const listRes = await request(app.getHttpServer())
        .get("/clients")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.length).toBe(1);
      expect(listRes.body[0].id || listRes.body[0]._id).toBe(client1Id);
      expect(listRes.body[0].name).toBe("E2E Client One");
    });

    it("client user 1 can GET their own client by id", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/clients/${client1Id}`)
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .expect(200);

      expect(res.body.id || res.body._id).toBe(client1Id);
      expect(res.body.name).toBe("E2E Client One");
    });

    it("client user 1 cannot GET the other client by id (403)", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/clients/${client2Id}`)
        .set("Authorization", `Bearer ${loginRes.body.access_token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("own client");
    });

    it("client user 2 sees only their client in GET /clients", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser2Email, password: clientUser2Password })
        .expect(200);

      const listRes = await request(app.getHttpServer())
        .get("/clients")
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .expect(200);

      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.length).toBe(1);
      expect(listRes.body[0].id || listRes.body[0]._id).toBe(client2Id);
      expect(listRes.body[0].name).toBe("E2E Client Two");
    });

    it("client user 2 can GET their own client by id", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser2Email, password: clientUser2Password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/clients/${client2Id}`)
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .expect(200);

      expect(res.body.id || res.body._id).toBe(client2Id);
      expect(res.body.name).toBe("E2E Client Two");
    });

    it("client user 2 cannot GET the other client by id (403)", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser2Email, password: clientUser2Password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/clients/${client1Id}`)
        .set("Authorization", `Bearer ${loginRes.body.access_token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("own client");
    });
  });

  describe("Client creation with email", () => {
    const welcomeTestEmail = "e2e.welcome.client@test.example.com";
    const welcomeTestContact = "Welcome Contact";

    it("rejects create without email", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E No Email Client",
          officeId: office1Id,
        });

      expect(createRes.status).toBe(400);
      expect(String(createRes.body.message)).toContain("Client email is required");
    });

    it("creates a client user and sends welcome email when client has email", async () => {
      mailServiceMock.sendWelcomeEmail.mockClear();

      const createRes = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Welcome Client",
          officeId: office1Id,
          email: welcomeTestEmail,
          contactPerson: welcomeTestContact,
        })
        .expect(201);

      const createdClientId = createRes.body.id ?? createRes.body._id;
      clientWelcomeId = createdClientId;
      userWelcomeEmail = welcomeTestEmail;

      const user = await userModel.findOne({ email: welcomeTestEmail });
      expect(user).toBeDefined();
      expect(user?.roleCode).toBe("client");
      expect(String(user?.client)).toBe(createdClientId);
      expect(user?.mustChangePassword).toBe(true);

      expect(mailServiceMock.sendWelcomeEmail).toHaveBeenCalledTimes(1);
      expect(mailServiceMock.sendWelcomeEmail).toHaveBeenCalledWith(
        welcomeTestEmail,
        welcomeTestContact,
        expect.any(String),
      );
      const [, , tempPassword] = mailServiceMock.sendWelcomeEmail.mock.calls[0];
      expect(tempPassword).toBeTruthy();
      expect(tempPassword.length).toBeGreaterThan(0);
    });

    it("rejects duplicate client email", async () => {
      const duplicateEmail = "e2e.duplicate.client.email@test.example.com";

      const firstCreate = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Duplicate Email Client 1",
          officeId: office1Id,
          email: duplicateEmail,
        })
        .expect(201);

      const firstClientId = firstCreate.body.id ?? firstCreate.body._id;

      const duplicateCreate = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Duplicate Email Client 2",
          officeId: office1Id,
          email: duplicateEmail,
        });

      expect(duplicateCreate.status).toBe(400);
      expect(String(duplicateCreate.body.message)).toContain(
        `A client with email "${duplicateEmail}" already exists`,
      );

      await userModel.deleteMany({ email: duplicateEmail });
      await clientModel.deleteOne({ _id: new Types.ObjectId(firstClientId) });
    });

    it("rejects duplicate user email", async () => {
      const duplicateUserEmail = "e2e.duplicate.user.email@test.example.com";
      const clientRole = await roleModel.findOne({ code: "client" }).exec();
      expect(clientRole).toBeTruthy();

      const seededUser = await userModel.create({
        firstName: "Duplicate",
        lastName: "User",
        email: duplicateUserEmail,
        password: await bcrypt.hash("Temp12345!", 10),
        roleCode: "client",
        role: clientRole!._id,
        company: new Types.ObjectId(companyId),
        offices: [new Types.ObjectId(office1Id)],
        permissions: [],
        isActive: true,
      });

      const createRes = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Duplicate Existing User",
          officeId: office1Id,
          email: duplicateUserEmail,
        });

      expect(createRes.status).toBe(400);
      expect(String(createRes.body.message)).toContain(
        `A user with email "${duplicateUserEmail}" already exists`,
      );

      await userModel.deleteOne({ _id: seededUser._id });
    });

    it("rolls back client creation if linked user creation fails", async () => {
      const rollbackEmail = "e2e.rollback.client.user.fail@test.example.com";
      const rollbackName = "E2E Rollback User Fail";

      const removedRole = await roleModel.findOneAndDelete({ code: "client" }).lean();
      expect(removedRole).toBeTruthy();

      const createRes = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: rollbackName,
          officeId: office1Id,
          email: rollbackEmail,
        });

      expect(createRes.status).toBe(400);
      expect(String(createRes.body.message)).toContain("Client role not found");

      const createdClient = await clientModel.findOne({ email: rollbackEmail }).lean();
      const createdUser = await userModel.findOne({ email: rollbackEmail }).lean();
      const historyEntry = await historyModel
        .findOne({ entityType: "client", summary: `Client "${rollbackName}" created` })
        .lean();
      expect(createdClient).toBeNull();
      expect(createdUser).toBeNull();
      expect(historyEntry).toBeNull();

      await roleModel.create({
        ...(removedRole as any),
        _id: removedRole!._id,
      });
    });

    it("welcome email failure does not roll back created client/user", async () => {
      const emailFailureAddress = "e2e.welcome.failure@test.example.com";
      mailServiceMock.sendWelcomeEmail.mockRejectedValueOnce(
        new Error("SMTP outage"),
      );

      const createRes = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Welcome Failure Client",
          officeId: office1Id,
          email: emailFailureAddress,
          contactPerson: "Welcome Failure Contact",
        })
        .expect(201);

      const createdClientId = createRes.body.id ?? createRes.body._id;
      const createdClient = await clientModel
        .findById(new Types.ObjectId(createdClientId))
        .lean();
      const createdUser = await userModel.findOne({ email: emailFailureAddress }).lean();

      expect(createdClient).toBeTruthy();
      expect(createdUser).toBeTruthy();
      expect(String((createdUser as any).client)).toBe(createdClientId);

      await userModel.deleteMany({ email: emailFailureAddress });
      await clientModel.deleteOne({ _id: new Types.ObjectId(createdClientId) });
    });

    it("temp password works only until user changes password, then it no longer works", async () => {
      const tempPasswordOnceEmail = "e2e.temp-password-once@test.example.com";
      const newPassword = "NewSecurePass123!";
      mailServiceMock.sendWelcomeEmail.mockClear();

      const createRes = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Temp Password Once",
          officeId: office1Id,
          email: tempPasswordOnceEmail,
          contactPerson: "Temp Once Contact",
        })
        .expect(201);

      clientTempPasswordOnceId = createRes.body.id ?? createRes.body._id;
      userTempPasswordOnceEmail = tempPasswordOnceEmail;

      const [, , tempPassword] = mailServiceMock.sendWelcomeEmail.mock.calls[0];
      expect(tempPassword).toBeTruthy();

      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: tempPasswordOnceEmail, password: tempPassword })
        .expect(200);
      expect(loginRes.body.user.mustChangePassword).toBe(true);
      const token = loginRes.body.access_token;

      await request(app.getHttpServer())
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: tempPassword, newPassword })
        .expect(200);

      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: tempPasswordOnceEmail, password: tempPassword })
        .expect(401);

      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: tempPasswordOnceEmail, password: newPassword })
        .expect(200);
    });

    it("create rejects invalid email format", async () => {
      const res = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Invalid Email Create",
          officeId: office1Id,
          email: "not-an-email",
        });

      expect(res.status).toBe(400);
    });

    it("create rejects blank email", async () => {
      const res = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Blank Email Create",
          officeId: office1Id,
          email: "   ",
        });

      expect(res.status).toBe(400);
    });

    it("create validates officeId as ObjectId", async () => {
      const res = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Invalid OfficeId Create",
          officeId: "not-an-object-id",
          email: "e2e.invalid.officeid@test.example.com",
        });

      expect(res.status).toBe(400);
    });
  });

  describe("Client update transactional email sync", () => {
    it("updates client email and linked user email successfully", async () => {
      const createEmail = "e2e.update.sync.create@test.example.com";
      const updatedEmail = "e2e.update.sync.updated@test.example.com";

      const createRes = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Update Sync Client",
          officeId: office1Id,
          email: createEmail,
          contactPerson: "Update Sync Contact",
        })
        .expect(201);

      const clientId = createRes.body.id ?? createRes.body._id;

      const updateRes = await request(app.getHttpServer())
        .patch(`/clients/${clientId}`)
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({ email: updatedEmail })
        .expect(200);

      expect(updateRes.body.email).toBe(updatedEmail);

      const updatedClient = await clientModel.findById(clientId).lean();
      const updatedUser = await userModel.findOne({ client: new Types.ObjectId(clientId) }).lean();
      expect(updatedClient?.email).toBe(updatedEmail);
      expect((updatedUser as any)?.email).toBe(updatedEmail);

      await userModel.deleteMany({ email: { $in: [createEmail, updatedEmail] } });
      await clientModel.deleteOne({ _id: new Types.ObjectId(clientId) });
    });

    it("rolls back client update if linked user email update fails", async () => {
      const createEmail = "e2e.update.rollback.create@test.example.com";
      const targetEmail = "e2e.update.rollback.target@test.example.com";

      const createRes = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Update Rollback Client",
          officeId: office1Id,
          email: createEmail,
          contactPerson: "Rollback Contact",
        })
        .expect(201);
      const clientId = createRes.body.id ?? createRes.body._id;

      const findByIdAndUpdateSpy = jest
        .spyOn(userModel, "findByIdAndUpdate")
        .mockImplementationOnce(() => {
          throw new Error("forced user update failure");
        });

      const updateRes = await request(app.getHttpServer())
        .patch(`/clients/${clientId}`)
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({ email: targetEmail });

      expect(updateRes.status).toBeGreaterThanOrEqual(400);

      const clientAfter = await clientModel.findById(clientId).lean();
      const userAfter = await userModel.findOne({ client: new Types.ObjectId(clientId) }).lean();
      expect(clientAfter?.email).toBe(createEmail);
      expect((userAfter as any)?.email).toBe(createEmail);

      findByIdAndUpdateSpy.mockRestore();
      await userModel.deleteMany({ email: { $in: [createEmail, targetEmail] } });
      await clientModel.deleteOne({ _id: new Types.ObjectId(clientId) });
    });

    it("rejects updating to an email used by another client", async () => {
      const emailA = "e2e.update.dup.client.a@test.example.com";
      const emailB = "e2e.update.dup.client.b@test.example.com";

      const createA = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({ name: "E2E Dup Client A", officeId: office1Id, email: emailA })
        .expect(201);
      const createB = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({ name: "E2E Dup Client B", officeId: office1Id, email: emailB })
        .expect(201);

      const clientBId = createB.body.id ?? createB.body._id;

      const updateRes = await request(app.getHttpServer())
        .patch(`/clients/${clientBId}`)
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({ email: emailA });

      expect(updateRes.status).toBe(400);
      expect(String(updateRes.body.message)).toContain(
        `A client with email "${emailA}" already exists`,
      );

      await userModel.deleteMany({ email: { $in: [emailA, emailB] } });
      await clientModel.deleteMany({
        _id: {
          $in: [
            new Types.ObjectId(createA.body.id ?? createA.body._id),
            new Types.ObjectId(clientBId),
          ],
        },
      });
    });

    it("rejects updating to an email used by another unrelated user", async () => {
      const createEmail = "e2e.update.dup.user.client@test.example.com";
      const duplicateUserEmail = "e2e.update.dup.user.target@test.example.com";

      const createRes = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Dup User Client",
          officeId: office1Id,
          email: createEmail,
        })
        .expect(201);
      const clientId = createRes.body.id ?? createRes.body._id;

      const clientRole = await roleModel.findOne({ code: "client" }).exec();
      const seededUser = await userModel.create({
        firstName: "Seed",
        lastName: "User",
        email: duplicateUserEmail,
        password: await bcrypt.hash("Temp12345!", 10),
        roleCode: "client",
        role: clientRole!._id,
        company: new Types.ObjectId(companyId),
        offices: [new Types.ObjectId(office1Id)],
        permissions: [],
        isActive: true,
      });

      const updateRes = await request(app.getHttpServer())
        .patch(`/clients/${clientId}`)
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({ email: duplicateUserEmail });

      expect(updateRes.status).toBe(400);
      expect(String(updateRes.body.message)).toContain(
        `A user with email "${duplicateUserEmail}" already exists`,
      );

      await userModel.deleteOne({ _id: seededUser._id });
      await userModel.deleteMany({ email: createEmail });
      await clientModel.deleteOne({ _id: new Types.ObjectId(clientId) });
    });

    it("rejects blank email input on update", async () => {
      const createEmail = "e2e.update.blank.create@test.example.com";
      const createRes = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Blank Email Update Client",
          officeId: office1Id,
          email: createEmail,
        })
        .expect(201);
      const clientId = createRes.body.id ?? createRes.body._id;

      const updateRes = await request(app.getHttpServer())
        .patch(`/clients/${clientId}`)
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({ email: "   " });

      expect(updateRes.status).toBe(400);

      await userModel.deleteMany({ email: createEmail });
      await clientModel.deleteOne({ _id: new Types.ObjectId(clientId) });
    });

    it("rejects update for inactive client", async () => {
      const createEmail = "e2e.update.inactive.client@test.example.com";
      const createRes = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Inactive Update Client",
          officeId: office1Id,
          email: createEmail,
        })
        .expect(201);
      const clientId = createRes.body.id ?? createRes.body._id;

      await clientModel.findByIdAndUpdate(clientId, { isActive: false }).exec();
      const updateRes = await request(app.getHttpServer())
        .patch(`/clients/${clientId}`)
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({ name: "Should not update" });

      expect(updateRes.status).toBe(404);

      await userModel.deleteMany({ email: createEmail });
      await clientModel.deleteOne({ _id: new Types.ObjectId(clientId) });
    });

    it("update rejects invalid email format when provided", async () => {
      const createEmail = "e2e.update.invalid-email.create@test.example.com";
      const createRes = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Invalid Email Update Client",
          officeId: office1Id,
          email: createEmail,
        })
        .expect(201);
      const clientId = createRes.body.id ?? createRes.body._id;

      const updateRes = await request(app.getHttpServer())
        .patch(`/clients/${clientId}`)
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({ email: "not-an-email" });

      expect(updateRes.status).toBe(400);

      await userModel.deleteMany({ email: createEmail });
      await clientModel.deleteOne({ _id: new Types.ObjectId(clientId) });
    });
  });

  describe("Client-role users cannot create, update, or delete clients", () => {
    it("client user cannot create a client (403)", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .send({
          name: "Forbidden Client",
          officeId: office1Id,
          email: "e2e.forbidden.client@test.example.com",
        });

      expect(res.status).toBe(403);
    });

    it("client user cannot update a client (403)", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/clients/${client1Id}`)
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .send({ name: "Updated Name" });

      expect(res.status).toBe(403);
    });

    it("client user cannot delete a client (403)", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .delete(`/clients/${client1Id}`)
        .set("Authorization", `Bearer ${loginRes.body.access_token}`);

      expect(res.status).toBe(403);
    });
  });

  describe("Remove inactive behavior", () => {
    it("remove on inactive client returns not found", async () => {
      const clientEmail = "e2e.remove.inactive@test.example.com";
      const createRes = await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          name: "E2E Remove Inactive Client",
          officeId: office1Id,
          email: clientEmail,
        })
        .expect(201);

      const clientId = createRes.body.id ?? createRes.body._id;
      await clientModel.findByIdAndUpdate(clientId, { isActive: false }).exec();

      const removeRes = await request(app.getHttpServer())
        .delete(`/clients/${clientId}`)
        .set("Authorization", `Bearer ${operatorToken}`);
      expect(removeRes.status).toBe(404);

      await userModel.deleteMany({ email: clientEmail });
      await clientModel.deleteOne({ _id: new Types.ObjectId(clientId) });
    });
  });

  describe("PATCH /clients/me (client updates own info)", () => {
    it("client user can update their own client via PATCH /clients/me", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch("/clients/me")
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .send({ name: "E2E Client One Updated", contactPerson: "Updated Contact" })
        .expect(200);

      expect(res.body.name).toBe("E2E Client One Updated");
      expect(res.body.contactPerson).toBe("Updated Contact");
      expect(res.body.id || res.body._id).toBe(client1Id);

      // Revert name so later tests (e.g. operator list) see consistent data
      await request(app.getHttpServer())
        .patch("/clients/me")
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .send({ name: "E2E Client One" })
        .expect(200);
    });

    it("client user cannot update via PATCH /clients/:id (403)", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/clients/${client1Id}`)
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .send({ name: "Should Fail" });

      expect(res.status).toBe(403);
    });

    it("operator (no client:update-own) gets 403 on PATCH /clients/me", async () => {
      const res = await request(app.getHttpServer())
        .patch("/clients/me")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({ name: "Should Fail" });

      expect(res.status).toBe(403);
    });

    it("returns 401 without auth", async () => {
      await request(app.getHttpServer())
        .patch("/clients/me")
        .send({ name: "Test" })
        .expect(401);
    });
  });

  describe("GET /clients/price-list", () => {
    it("invalid dateFrom is rejected", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get("/clients/price-list")
        .query({ dateFrom: "invalid-date" })
        .set("Authorization", `Bearer ${loginRes.body.access_token}`);

      expect(res.status).toBe(400);
    });

    it("invalid dateTo is rejected", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get("/clients/price-list")
        .query({ dateTo: "invalid-date" })
        .set("Authorization", `Bearer ${loginRes.body.access_token}`);

      expect(res.status).toBe(400);
    });

    it("dateFrom greater than dateTo is rejected", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get("/clients/price-list")
        .query({ dateFrom: "2026-03-20", dateTo: "2026-03-10" })
        .set("Authorization", `Bearer ${loginRes.body.access_token}`);

      expect(res.status).toBe(400);
    });

    it("authenticated client retrieves only their own quotation deliveries", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);
      const res = await request(app.getHttpServer())
        .get("/clients/price-list")
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      res.body.forEach((d: { quotationSnapshot?: unknown; sentAt?: string }) => {
        expect(d.quotationSnapshot).toBeDefined();
        expect(d.sentAt).toBeDefined();
      });
    });

    it("date filtering works with both dateFrom and dateTo", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);
      const res = await request(app.getHttpServer())
        .get("/clients/price-list")
        .query({ dateFrom: "2025-01-01", dateTo: "2025-06-30" })
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it("date filtering with only dateFrom returns records on or after that date", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);
      const res = await request(app.getHttpServer())
        .get("/clients/price-list")
        .query({ dateFrom: "2025-06-01" })
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(new Date(res.body[0].sentAt).getFullYear()).toBe(2025);
      expect(new Date(res.body[0].sentAt).getMonth()).toBe(5);
    });

    it("date filtering with only dateTo returns records on or before that date", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);
      const res = await request(app.getHttpServer())
        .get("/clients/price-list")
        .query({ dateTo: "2025-02-01" })
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
    });

    it("deliveries from other clients are not returned", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);
      const res = await request(app.getHttpServer())
        .get("/clients/price-list")
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .expect(200);
      const notes = (res.body as Array<{ quotationSnapshot?: { notes?: string } }>).map(
        (d) => d.quotationSnapshot?.notes
      );
      expect(notes).not.toContain("E2E Client Two delivery");
    });

    it("operator (non-client user) gets 403", async () => {
      const res = await request(app.getHttpServer())
        .get("/clients/price-list")
        .set("Authorization", `Bearer ${operatorToken}`);
      expect(res.status).toBe(403);
    });

    it("returns 401 without auth", async () => {
      await request(app.getHttpServer()).get("/clients/price-list").expect(401);
    });
  });

  describe("GET /clients/shipments", () => {
    it("authenticated client retrieves only their own shipments", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);
      const res = await request(app.getHttpServer())
        .get("/clients/shipments")
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].parties?.shipper?.name).toBe("E2E Client One");
    });

    it("date filtering works correctly", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser1Email, password: clientUser1Password })
        .expect(200);
      const res = await request(app.getHttpServer())
        .get("/clients/shipments")
        .query({ dateFrom: "2025-01-01", dateTo: "2025-03-01" })
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
    });

    it("shipments from other clients are not returned", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: clientUser2Email, password: clientUser2Password })
        .expect(200);
      const res = await request(app.getHttpServer())
        .get("/clients/shipments")
        .set("Authorization", `Bearer ${loginRes.body.access_token}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].parties?.consignee?.name).toBe("E2E Client Two");
    });

    it("operator (non-client user) gets 403", async () => {
      const res = await request(app.getHttpServer())
        .get("/clients/shipments")
        .set("Authorization", `Bearer ${operatorToken}`);
      expect(res.status).toBe(403);
    });

    it("returns 401 without auth", async () => {
      await request(app.getHttpServer()).get("/clients/shipments").expect(401);
    });
  });

  describe("Operator (ops_admin) can list and access clients", () => {
    it("GET /clients returns 401 without auth", async () => {
      await request(app.getHttpServer()).get("/clients").expect(401);
    });

    it("operator can list clients", async () => {
      const res = await request(app.getHttpServer())
        .get("/clients")
        .set("Authorization", `Bearer ${operatorToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body.some((c: { name?: string }) => c.name === "E2E Client One")).toBe(true);
      expect(res.body.some((c: { name?: string }) => c.name === "E2E Client Two")).toBe(true);
    });

    it("operator can get any client by id", async () => {
      const res = await request(app.getHttpServer())
        .get(`/clients/${client1Id}`)
        .set("Authorization", `Bearer ${operatorToken}`)
        .expect(200);

      expect(res.body.name).toBe("E2E Client One");
    });
  });
});
