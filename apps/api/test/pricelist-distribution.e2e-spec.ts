import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { Model } from "mongoose";
import { getModelToken } from "@nestjs/mongoose";
import {
  AgentPricelist,
  AgentPricelistDocument,
  PricelistStatus,
} from "../src/schemas/agent-pricelist.schema";
import {
  PricelistDistribution,
  PricelistDistributionDocument,
} from "../src/schemas/pricelist-distribution.schema";
import { Client, ClientDocument } from "../src/schemas/client.schema";
import { getWeekStart } from "../src/common/utils/week-calculation.util";

/**
 * E2E Test Suite for Pricelist Distribution to Clients
 *
 * Prerequisites:
 * - Test operator user (john.doe@shipsync.com) must exist with ops_admin role
 * - MongoDB must be running
 *
 * Test Flow:
 * 1. Setup: Create test data (operator, agent, supplier, approved pricelist, clients)
 * 2. Test: Send pricelist to specific clients
 * 3. Test: Send pricelist to all clients
 * 4. Test: Validation errors (unapproved pricelist, invalid clientIds, etc.)
 * 5. Cleanup: Remove test data
 */

describe("Pricelist Distribution to Clients (e2e)", () => {
  let app: INestApplication;
  let operatorAuthToken: string;
  let testOperatorId: string;
  let testAgentId: string;
  let testSupplierId: string;
  let testApprovedPricelistId: string;
  let testDraftPricelistId: string;
  let testClientId1: string;
  let testClientId2: string;
  let testOfficeId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login as operator
    console.log("Logging in as operator...");
    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "john.doe@shipsync.com",
        password: "password123",
      });

    if (loginResponse.status === 200) {
      operatorAuthToken = loginResponse.body.access_token;
    } else {
      throw new Error(
        `Failed to login test operator: ${JSON.stringify(loginResponse.body)}`,
      );
    }

    // Get operator user
    const userModel = app.get<Model<any>>(getModelToken("User"));
    const operator = await userModel.findOne({ email: "john.doe@shipsync.com" }).exec();
    if (!operator) {
      throw new Error("Test operator not found");
    }
    testOperatorId = operator._id.toString();
    testOfficeId = operator.offices?.[0]?.toString() || operator.office?.toString();

    // Create test supplier
    console.log("Creating test supplier...");
    const createSupplierResponse = await request(app.getHttpServer())
      .post("/shipping-lines")
      .set("Authorization", `Bearer ${operatorAuthToken}`)
      .send({
        name: `Distribution Test Supplier ${Date.now()}`,
        email: `dist-test-supplier-${Date.now()}@example.com`,
        phone: "+1234567890",
        shippingModes: ["maritime"],
        isActive: true,
      });

    if (createSupplierResponse.status === 201) {
      testSupplierId = createSupplierResponse.body.id || createSupplierResponse.body._id;
    } else {
      const suppliersResponse = await request(app.getHttpServer())
        .get("/shipping-lines")
        .set("Authorization", `Bearer ${operatorAuthToken}`);

      if (suppliersResponse.status === 200 && suppliersResponse.body.length > 0) {
        testSupplierId = suppliersResponse.body[0]._id || suppliersResponse.body[0].id;
      } else {
        throw new Error("Failed to create or find test supplier");
      }
    }

    // Create test agent
    console.log("Creating test agent...");
    const createAgentResponse = await request(app.getHttpServer())
      .post("/agents")
      .set("Authorization", `Bearer ${operatorAuthToken}`)
      .send({
        firstName: "Distribution",
        lastName: "TestAgent",
        email: `dist-test-agent-${Date.now()}@example.com`,
        phone: "+1234567890",
        address: {
          street: "123 Test St",
          city: "Test City",
          state: "TS",
          zipCode: "12345",
          country: "US",
        },
        shippingLineId: testSupplierId,
        isActive: true,
      });

    if (createAgentResponse.status === 201) {
      testAgentId = createAgentResponse.body.id || createAgentResponse.body._id;
    } else {
      throw new Error(
        `Failed to create test agent: ${JSON.stringify(createAgentResponse.body)}`,
      );
    }

    // Create test clients
    console.log("Creating test clients...");
    const clientModel = app.get<Model<ClientDocument>>(getModelToken(Client.name));

    // Get or create office for clients
    if (!testOfficeId) {
      // Try to get first office
      const officeModel = app.get<Model<any>>(getModelToken("Office"));
      const offices = await officeModel.find().limit(1).exec();
      if (offices.length > 0) {
        testOfficeId = offices[0]._id.toString();
      } else {
        throw new Error("No office found for test clients");
      }
    }

    const client1 = await clientModel.create({
      name: `Distribution Test Client 1 ${Date.now()}`,
      office: testOfficeId,
      email: `dist-test-client1-${Date.now()}@example.com`,
      phone: "+1234567890",
      isActive: true,
    });
    testClientId1 = client1._id.toString();

    const client2 = await clientModel.create({
      name: `Distribution Test Client 2 ${Date.now()}`,
      office: testOfficeId,
      email: `dist-test-client2-${Date.now()}@example.com`,
      phone: "+1234567891",
      isActive: true,
    });
    testClientId2 = client2._id.toString();

    // Create approved pricelist
    console.log("Creating approved pricelist...");
    const pricelistModel = app.get<Model<AgentPricelistDocument>>(
      getModelToken(AgentPricelist.name),
    );
    const weekStart = getWeekStart(new Date());

    const approvedPricelist = await pricelistModel.create({
      agentId: testAgentId,
      supplierId: testSupplierId,
      weekStart: weekStart,
      weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
      status: PricelistStatus.APPROVED,
      submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      approvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      items: [
        {
          name: "Approved Test Item",
          chargeType: "OCEAN_FREIGHT",
          incoterm: "FOB",
          equipmentType: "40HQ",
          lane: {
            originPortCode: "CNNGB",
            originName: "Ningbo",
            destinationPortCode: "HNPCR",
            destinationName: "Puerto Cortes",
          },
          cost: 1500,
          currency: "USD",
          pricingUnit: "PER_CONTAINER",
        },
      ],
      totalCost: 1500,
      itemCount: 1,
    });
    testApprovedPricelistId = approvedPricelist._id.toString();

    // Create draft pricelist (for validation testing)
    const draftPricelist = await pricelistModel.create({
      agentId: testAgentId,
      supplierId: testSupplierId,
      weekStart: weekStart,
      weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
      status: PricelistStatus.DRAFT,
      items: [
        {
          name: "Draft Test Item",
          chargeType: "OCEAN_FREIGHT",
          incoterm: "CIF",
          equipmentType: "20GP",
          lane: {
            originPortCode: "CNSHA",
            originName: "Shanghai",
            destinationPortCode: "HNSLZ",
            destinationName: "San Lorenzo",
          },
          cost: 1200,
          currency: "USD",
          pricingUnit: "PER_CONTAINER",
        },
      ],
      totalCost: 1200,
      itemCount: 1,
    });
    testDraftPricelistId = draftPricelist._id.toString();

    console.log("Test setup complete");
    console.log(`- Approved Pricelist ID: ${testApprovedPricelistId}`);
    console.log(`- Draft Pricelist ID: ${testDraftPricelistId}`);
    console.log(`- Client 1 ID: ${testClientId1}`);
    console.log(`- Client 2 ID: ${testClientId2}`);
  });

  afterAll(async () => {
    // Cleanup test data
    if (app) {
      const pricelistModel = app.get<Model<AgentPricelistDocument>>(
        getModelToken(AgentPricelist.name),
      );
      const distributionModel = app.get<Model<PricelistDistributionDocument>>(
        getModelToken(PricelistDistribution.name),
      );
      const clientModel = app.get<Model<ClientDocument>>(getModelToken(Client.name));

      try {
        // Delete distributions
        await distributionModel.deleteMany({
          pricelistId: { $in: [testApprovedPricelistId, testDraftPricelistId] },
        }).exec();

        // Delete pricelists
        if (testApprovedPricelistId) {
          await pricelistModel.findByIdAndDelete(testApprovedPricelistId).exec();
        }
        if (testDraftPricelistId) {
          await pricelistModel.findByIdAndDelete(testDraftPricelistId).exec();
        }

        // Delete clients
        if (testClientId1) {
          await clientModel.findByIdAndDelete(testClientId1).exec();
        }
        if (testClientId2) {
          await clientModel.findByIdAndDelete(testClientId2).exec();
        }

        // Delete agent and supplier
        if (testAgentId) {
          await request(app.getHttpServer())
            .delete(`/agents/${testAgentId}`)
            .set("Authorization", `Bearer ${operatorAuthToken}`);
        }
        if (testSupplierId) {
          await request(app.getHttpServer())
            .delete(`/shipping-lines/${testSupplierId}`)
            .set("Authorization", `Bearer ${operatorAuthToken}`);
        }
      } catch (error) {
        console.log("Cleanup error (OK):", error);
      }

      await app.close();
    }
  });

  describe("POST /pricing/send-to-clients", () => {
    it("should successfully send approved pricelist to specific clients", async () => {
      const response = await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          pricelistId: testApprovedPricelistId,
          clientIds: [testClientId1, testClientId2],
          sendToAll: false,
        })
        .expect(200);

      expect(response.body).toHaveProperty("success");
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty("pricelistId");
      expect(response.body.pricelistId).toBe(testApprovedPricelistId);
      expect(response.body).toHaveProperty("totalClients");
      expect(response.body.totalClients).toBe(2);
      expect(response.body).toHaveProperty("clientIds");
      expect(response.body.clientIds).toHaveLength(2);
      expect(response.body.clientIds).toContain(testClientId1);
      expect(response.body.clientIds).toContain(testClientId2);
      expect(response.body).toHaveProperty("sentAt");
      expect(response.body).toHaveProperty("distributionId");

      console.log("\n=== Distribution Response ===");
      console.log(JSON.stringify(response.body, null, 2));
      console.log("===========================\n");

      // Verify distribution record was created
      const distributionModel = app.get<Model<PricelistDistributionDocument>>(
        getModelToken(PricelistDistribution.name),
      );
      const distribution = await distributionModel
        .findById(response.body.distributionId)
        .exec();
      expect(distribution).toBeDefined();
      expect(distribution?.pricelistId.toString()).toBe(testApprovedPricelistId);
      expect(distribution?.clientIds).toHaveLength(2);
      expect(distribution?.sendToAll).toBe(false);
      expect(distribution?.totalClients).toBe(2);
    });

    it("should successfully send approved pricelist to all clients when sendToAll is true", async () => {
      const response = await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          pricelistId: testApprovedPricelistId,
          clientIds: [], // Should be ignored
          sendToAll: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.totalClients).toBeGreaterThanOrEqual(2); // At least our 2 test clients
      expect(response.body.sendToAll).toBe(true);

      console.log(`\nSent to ${response.body.totalClients} clients (all active)`);
    });

    it("should return 400 when trying to send unapproved pricelist", async () => {
      const response = await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          pricelistId: testDraftPricelistId,
          clientIds: [testClientId1],
          sendToAll: false,
        })
        .expect(400);

      expect(response.body.message).toContain("approved");
      expect(response.body.message).toContain("draft");
    });

    it("should return 400 when clientIds is empty and sendToAll is false", async () => {
      const response = await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          pricelistId: testApprovedPricelistId,
          clientIds: [],
          sendToAll: false,
        })
        .expect(400);

      expect(response.body.message).toContain("clientIds");
    });

    it("should return 404 when pricelist does not exist", async () => {
      const fakeId = "507f1f77bcf86cd799439999";
      const response = await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          pricelistId: fakeId,
          clientIds: [testClientId1],
          sendToAll: false,
        })
        .expect(404);

      expect(response.body.message).toContain("not found");
    });

    it("should return 404 when client does not exist", async () => {
      const fakeClientId = "507f1f77bcf86cd799439999";
      const response = await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          pricelistId: testApprovedPricelistId,
          clientIds: [fakeClientId],
          sendToAll: false,
        })
        .expect(404);

      expect(response.body.message).toContain("not found");
    });

    it("should return 400 when pricelistId format is invalid", async () => {
      const response = await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          pricelistId: "invalid-id",
          clientIds: [testClientId1],
          sendToAll: false,
        })
        .expect(400);

      expect(response.body.message).toContain("Invalid pricelistId format");
    });

    it("should return 401 Unauthorized without auth token", async () => {
      await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .send({
          pricelistId: testApprovedPricelistId,
          clientIds: [testClientId1],
          sendToAll: false,
        })
        .expect(401);
    });
  });

  describe("Distribution Audit Trail", () => {
    it("should create distribution record with correct audit fields", async () => {
      const distributionModel = app.get<Model<PricelistDistributionDocument>>(
        getModelToken(PricelistDistribution.name),
      );

      // Send pricelist
      const response = await request(app.getHttpServer())
        .post("/pricing/send-to-clients")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          pricelistId: testApprovedPricelistId,
          clientIds: [testClientId1],
          sendToAll: false,
        })
        .expect(200);

      // Verify distribution record
      const distribution = await distributionModel
        .findById(response.body.distributionId)
        .exec();

      expect(distribution).toBeDefined();
      expect(distribution?.pricelistId.toString()).toBe(testApprovedPricelistId);
      expect(distribution?.sentBy.toString()).toBe(testOperatorId);
      expect(distribution?.sentByEmail).toBe("john.doe@shipsync.com");
      expect(distribution?.sentAt).toBeDefined();
      expect(distribution?.totalClients).toBe(1);
      expect(distribution?.sendToAll).toBe(false);
    });
  });
});
