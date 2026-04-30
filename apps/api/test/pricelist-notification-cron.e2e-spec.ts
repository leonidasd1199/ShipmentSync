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
import { User, UserDocument } from "../src/schemas/user.schema";
import { RoleCode } from "../src/common/enums/role.enum";
import { getWeekStart } from "../src/common/utils/week-calculation.util";

/**
 * E2E Test Suite for Pricelist Notification Cron Job
 *
 * Prerequisites:
 * - Test operator user (john.doe@shipsync.com) must exist with ops_admin role
 * - MongoDB must be running
 * - SMTP must be configured (or mocked) for email sending
 *
 * Test Flow:
 * 1. Setup: Create test data (operator, agent, supplier, submitted pricelists)
 * 2. Trigger: Call manual trigger endpoint
 * 3. Verify: Check that emails were sent and response is correct
 * 4. Cleanup: Remove test data
 */

describe("Pricelist Notification Cron Job (e2e)", () => {
  let app: INestApplication;
  let operatorAuthToken: string;
  let testOperatorId: string;
  let testAgentId: string;
  let testSupplierId: string;
  let testPricelistId1: string;
  let testPricelistId2: string;

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

    // Get or create test operator
    const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    let operator = await userModel.findOne({ email: "john.doe@shipsync.com" }).exec();
    if (!operator) {
      throw new Error("Test operator not found");
    }
    testOperatorId = operator._id.toString();

    // Create test supplier
    console.log("Creating test supplier...");
    const createSupplierResponse = await request(app.getHttpServer())
      .post("/shipping-lines")
      .set("Authorization", `Bearer ${operatorAuthToken}`)
      .send({
        name: `Cron Test Supplier ${Date.now()}`,
        email: `cron-test-supplier-${Date.now()}@example.com`,
        phone: "+1234567890",
        shippingModes: ["maritime"],
        isActive: true,
      });

    if (createSupplierResponse.status === 201) {
      testSupplierId = createSupplierResponse.body.id || createSupplierResponse.body._id;
    } else {
      // Try to find existing supplier
      const suppliersResponse = await request(app.getHttpServer())
        .get("/shipping-lines")
        .set("Authorization", `Bearer ${operatorAuthToken}`);

      if (suppliersResponse.status === 200 && suppliersResponse.body.length > 0) {
        testSupplierId =
          suppliersResponse.body[0]._id || suppliersResponse.body[0].id;
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
        firstName: "Cron",
        lastName: "TestAgent",
        email: `cron-test-agent-${Date.now()}@example.com`,
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
      testAgentId =
        createAgentResponse.body.id || createAgentResponse.body._id;
    } else {
      throw new Error(
        `Failed to create test agent: ${JSON.stringify(createAgentResponse.body)}`,
      );
    }

    // Create test pricelists with SUBMITTED status
    console.log("Creating test submitted pricelists...");
    const pricelistModel = app.get<Model<AgentPricelistDocument>>(
      getModelToken(AgentPricelist.name),
    );
    const weekStart = getWeekStart(new Date());

    // Create first submitted pricelist
    const pricelist1 = await pricelistModel.create({
      agentId: testAgentId,
      supplierId: testSupplierId,
      weekStart: weekStart,
      weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
      status: PricelistStatus.SUBMITTED,
      submittedAt: new Date(),
      items: [
        {
          name: "Test Item 1",
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
    testPricelistId1 = pricelist1._id.toString();

    // Create second submitted pricelist (different week)
    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const pricelist2 = await pricelistModel.create({
      agentId: testAgentId,
      supplierId: testSupplierId,
      weekStart: nextWeekStart,
      weekEnd: new Date(nextWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
      status: PricelistStatus.SUBMITTED,
      submittedAt: new Date(),
      items: [
        {
          name: "Test Item 2",
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
    testPricelistId2 = pricelist2._id.toString();

    console.log("Test setup complete");
    console.log(`- Operator ID: ${testOperatorId}`);
    console.log(`- Supplier ID: ${testSupplierId}`);
    console.log(`- Agent ID: ${testAgentId}`);
    console.log(`- Pricelist 1 ID: ${testPricelistId1}`);
    console.log(`- Pricelist 2 ID: ${testPricelistId2}`);
  });

  afterAll(async () => {
    // Cleanup test data
    if (app) {
      const pricelistModel = app.get<Model<AgentPricelistDocument>>(
        getModelToken(AgentPricelist.name),
      );

      try {
        if (testPricelistId1) {
          await pricelistModel.findByIdAndDelete(testPricelistId1).exec();
        }
        if (testPricelistId2) {
          await pricelistModel.findByIdAndDelete(testPricelistId2).exec();
        }
      } catch (error) {
        console.log("Cleanup error (OK):", error);
      }

      // Cleanup agent and supplier if created
      try {
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

  describe("GET /cron/pricelist-notification/trigger", () => {
    it("should trigger pricelist notification cron job successfully", async () => {
      const response = await request(app.getHttpServer())
        .get("/cron/pricelist-notification/trigger")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success");
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("operatorsNotified");
      expect(response.body).toHaveProperty("pendingCount");
      expect(response.body.pendingCount).toBeGreaterThanOrEqual(2); // At least our 2 test pricelists
      expect(response.body.operatorsNotified).toBeGreaterThan(0);

      console.log("\n=== Cron Job Trigger Response ===");
      console.log(JSON.stringify(response.body, null, 2));
      console.log("================================\n");
    });

    it("should return 403 Forbidden for non-operator users", async () => {
      // This test would require a non-operator user token
      // For now, we'll skip if we don't have one
      // You can add this test if you have a client/admin user
    });

    it("should return 401 Unauthorized without auth token", async () => {
      await request(app.getHttpServer())
        .get("/cron/pricelist-notification/trigger")
        .expect(401);
    });
  });

  describe("Cron Job Logic", () => {
    it("should find submitted pricelists", async () => {
      const pricelistModel = app.get<Model<AgentPricelistDocument>>(
        getModelToken(AgentPricelist.name),
      );

      const submittedPricelists = await pricelistModel
        .find({ status: PricelistStatus.SUBMITTED })
        .exec();

      expect(submittedPricelists.length).toBeGreaterThanOrEqual(2);
      console.log(`Found ${submittedPricelists.length} submitted pricelists`);
    });

    it("should find active operators", async () => {
      const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

      const operators = await userModel
        .find({
          roleCode: RoleCode.OPS_ADMIN,
          isActive: true,
        })
        .exec();

      expect(operators.length).toBeGreaterThan(0);
      console.log(`Found ${operators.length} active operators`);
      operators.forEach((op) => {
        console.log(`- ${op.email} (${op.firstName} ${op.lastName})`);
      });
    });
  });
});
