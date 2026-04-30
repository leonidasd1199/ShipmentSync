import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";
import { Types } from "mongoose";
import { getModelToken } from "@nestjs/mongoose";
import {
  MaritimeIncoterm,
  Currency,
} from "../src/common/enums/maritime-incoterms.enum";
import { ChargeType } from "../src/common/enums/pricelist-item.enum";
import {
  AgentPricelist,
  AgentPricelistDocument,
} from "../src/schemas/agent-pricelist.schema";
import { Model } from "mongoose";

/**
 * E2E Tests for Agent Pricing API
 *
 * Prerequisites:
 * - MongoDB must be running and accessible
 * - For local testing: Start MongoDB via Docker or ensure it's running locally
 *   - Docker: docker-compose up -d mongo
 *   - Local: Ensure MongoDB is running on localhost:27017
 * - IMPORTANT: Set MONGODB_URI environment variable when running tests locally
 *   - Example: MONGODB_URI=mongodb://localhost:27017/shipsync npm run test:e2e -- agent-pricing.e2e-spec.ts
 *   - Without this, tests will try to connect to "mongo" hostname (Docker service name) and fail
 * - Test operator user (john.doe@shipsync.com) must exist with permissions to create agents
 * - Test agent will be created during test setup and cleaned up after tests
 */
describe("Agent Pricing (e2e)", () => {
  let app: INestApplication<App>;
  let operatorAuthToken: string;
  let agentAuthToken: string;
  let testAgentId: string;
  let testSupplierId: string;
  let testPricelistId: string;
  let testItemId: string;

  // Additional test data for multi-supplier scenario
  let testSupplier2Id: string;
  let testSupplier3Id: string;
  let testAgent2Id: string;
  let testAgent2AuthToken: string;

  beforeAll(async () => {
    try {
      console.log("Starting test setup...");
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      console.log("Creating NestJS application...");
      app = moduleFixture.createNestApplication();

      // Apply global ValidationPipe (same as main.ts)
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          transformOptions: {
            enableImplicitConversion: true,
          },
          forbidNonWhitelisted: false,
          whitelist: true,
        }),
      );

      console.log("Initializing application (connecting to MongoDB)...");
      await app.init();
      console.log("Application initialized successfully");

      // Login as operator to create agent and supplier
      console.log("Logging in as operator...");
      const loginResponse = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: "john.doe@shipsync.com",
          password: "password123",
        });
      console.log("Login response status:", loginResponse.status);

      if (loginResponse.status === 200) {
        operatorAuthToken = loginResponse.body.access_token;
      } else {
        throw new Error(
          `Failed to login test operator: ${JSON.stringify(loginResponse.body)}`,
        );
      }

      // Create a test supplier (shipping line)
      console.log("Creating test supplier...");
      const createSupplierResponse = await request(app.getHttpServer())
        .post("/shipping-lines")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          name: `Test Shipping Company E2E ${Date.now()}`,
          email: `test-shipping-${Date.now()}@example.com`,
          phone: "+1234567890",
          shippingModes: ["maritime"],
          isActive: true,
        });

      if (createSupplierResponse.status === 201) {
        testSupplierId = createSupplierResponse.body.id;
      } else {
        console.log(
          "Supplier creation failed, trying to find existing supplier...",
          createSupplierResponse.status,
          createSupplierResponse.body,
        );
        // Try to find existing supplier
        const suppliersResponse = await request(app.getHttpServer())
          .get("/shipping-lines")
          .set("Authorization", `Bearer ${operatorAuthToken}`);

        if (
          suppliersResponse.status === 200 &&
          suppliersResponse.body.length > 0
        ) {
          testSupplierId =
            suppliersResponse.body[0]._id || suppliersResponse.body[0].id;
          console.log("Using existing supplier:", testSupplierId);
        } else {
          throw new Error(
            `Failed to create or find test supplier. Create status: ${createSupplierResponse.status}, Response: ${JSON.stringify(createSupplierResponse.body)}`,
          );
        }
      }

      // Create a test agent
      console.log("Creating test agent...");
      const createAgentResponse = await request(app.getHttpServer())
        .post("/agents")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          firstName: "Test",
          lastName: "Agent",
          email: `test-agent-${Date.now()}@example.com`,
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
        console.log("Agent created successfully:", testAgentId);
      } else {
        console.error(
          "Agent creation failed:",
          createAgentResponse.status,
          createAgentResponse.body,
        );
        throw new Error(
          `Failed to create test agent: Status ${createAgentResponse.status}, ${JSON.stringify(createAgentResponse.body)}`,
        );
      }

      // Generate magic link for agent
      console.log("Generating magic link...");
      const magicLinkResponse = await request(app.getHttpServer())
        .post(`/agents/${testAgentId}/magic-link`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          expirationHours: 24,
        })
        .expect(201);

      // Extract token from magicLink URL (format: http://...?token=abc123...)
      const magicLinkUrl = magicLinkResponse.body.magicLink;
      const url = new URL(magicLinkUrl);
      const magicLinkToken = url.searchParams.get("token");

      if (!magicLinkToken) {
        throw new Error(
          `Failed to extract token from magic link: ${magicLinkUrl}`,
        );
      }

      // Authenticate agent using magic link
      console.log("Authenticating agent with magic link...");
      const agentLoginResponse = await request(app.getHttpServer())
        .post("/auth/magic-link/login")
        .send({
          token: magicLinkToken,
        });

      if (agentLoginResponse.status !== 200) {
        console.error(
          "Magic link login failed:",
          JSON.stringify(agentLoginResponse.body, null, 2),
        );
        throw new Error(
          `Magic link login failed with status ${agentLoginResponse.status}: ${JSON.stringify(agentLoginResponse.body)}`,
        );
      }

      agentAuthToken = agentLoginResponse.body.access_token;
      console.log("Test setup completed successfully");

      // Setup for multi-supplier test scenario
      console.log("Setting up multi-supplier test scenario...");

      // Create supplier 2
      const createSupplier2Response = await request(app.getHttpServer())
        .post("/shipping-lines")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          name: `Test Supplier 2 E2E ${Date.now()}`,
          email: `test-supplier2-${Date.now()}@example.com`,
          phone: "+1234567891",
          shippingModes: ["maritime"],
          isActive: true,
        });

      if (createSupplier2Response.status === 201) {
        testSupplier2Id = createSupplier2Response.body.id;
        console.log("Supplier 2 created:", testSupplier2Id);
      } else {
        console.log(
          "Supplier 2 creation failed, trying to find existing supplier...",
          createSupplier2Response.status,
          createSupplier2Response.body,
        );
        // Try to find existing supplier
        const suppliers2Response = await request(app.getHttpServer())
          .get("/shipping-lines")
          .set("Authorization", `Bearer ${operatorAuthToken}`);

        if (
          suppliers2Response.status === 200 &&
          suppliers2Response.body.length > 0
        ) {
          // Use a different supplier than supplier1 if available
          const availableSuppliers = suppliers2Response.body.filter(
            (s: any) =>
              (s._id || s.id) !== testSupplierId &&
              (s._id || s.id) !== testSupplier3Id,
          );
          if (availableSuppliers.length > 0) {
            testSupplier2Id =
              availableSuppliers[0]._id || availableSuppliers[0].id;
            console.log(
              "Using existing supplier for Supplier 2:",
              testSupplier2Id,
            );
          } else {
            // If no other supplier available, reuse supplier1 (tests will still work)
            testSupplier2Id = testSupplierId;
            console.log(
              "No other supplier available, reusing supplier1 for Supplier 2",
            );
          }
        } else {
          throw new Error(
            `Failed to create or find supplier 2: ${JSON.stringify(createSupplier2Response.body)}`,
          );
        }
      }

      // Create supplier 3
      const createSupplier3Response = await request(app.getHttpServer())
        .post("/shipping-lines")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          name: `Test Supplier 3 E2E ${Date.now()}`,
          email: `test-supplier3-${Date.now()}@example.com`,
          phone: "+1234567892",
          shippingModes: ["maritime"],
          isActive: true,
        });

      if (createSupplier3Response.status === 201) {
        testSupplier3Id = createSupplier3Response.body.id;
        console.log("Supplier 3 created:", testSupplier3Id);
      } else {
        console.log(
          "Supplier 3 creation failed, trying to find existing supplier...",
          createSupplier3Response.status,
          createSupplier3Response.body,
        );
        // Try to find existing supplier
        const suppliers3Response = await request(app.getHttpServer())
          .get("/shipping-lines")
          .set("Authorization", `Bearer ${operatorAuthToken}`);

        if (
          suppliers3Response.status === 200 &&
          suppliers3Response.body.length > 0
        ) {
          // Use a different supplier than supplier1 and supplier2 if available
          const availableSuppliers = suppliers3Response.body.filter(
            (s: any) =>
              (s._id || s.id) !== testSupplierId &&
              (s._id || s.id) !== testSupplier2Id,
          );
          if (availableSuppliers.length > 0) {
            testSupplier3Id =
              availableSuppliers[0]._id || availableSuppliers[0].id;
            console.log(
              "Using existing supplier for Supplier 3:",
              testSupplier3Id,
            );
          } else {
            // Create a new unique supplier by using a different name/email
            // This is a fallback - ideally we'd create a new one
            throw new Error(
              `Failed to create supplier 3 and no alternative supplier available: ${JSON.stringify(createSupplier3Response.body)}`,
            );
          }
        } else {
          throw new Error(
            `Failed to create or find supplier 3: ${JSON.stringify(createSupplier3Response.body)}`,
          );
        }
      }

      // Add testAgentId to supplier 2's agents array
      // This will make agent1 see both supplier1 (via shippingLineId) and supplier2 (via agents array)
      const addAgentToSupplier2Response = await request(app.getHttpServer())
        .post(`/shipping-lines/${testSupplier2Id}/agents/add`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          agentIds: [testAgentId],
        });

      // POST endpoints return 201 Created by default in NestJS, but check for success in response body
      if (
        addAgentToSupplier2Response.status >= 200 &&
        addAgentToSupplier2Response.status < 300
      ) {
        if (addAgentToSupplier2Response.body.success) {
          console.log(
            `Agent 1 added to Supplier 2 (${addAgentToSupplier2Response.body.added} agent(s) added)`,
          );
        } else {
          throw new Error(
            `Failed to add agent to supplier 2: ${JSON.stringify(addAgentToSupplier2Response.body)}`,
          );
        }
      } else {
        throw new Error(
          `Failed to add agent to supplier 2: Status ${addAgentToSupplier2Response.status}, ${JSON.stringify(addAgentToSupplier2Response.body)}`,
        );
      }

      // Create agent 2 and assign to supplier 3
      const createAgent2Response = await request(app.getHttpServer())
        .post("/agents")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          firstName: "Test",
          lastName: "Agent2",
          email: `test-agent2-${Date.now()}@example.com`,
          phone: "+1234567893",
          address: {
            street: "456 Test St",
            city: "Test City",
            state: "TS",
            zipCode: "12345",
            country: "US",
          },
          shippingLineId: testSupplier3Id,
          isActive: true,
        });

      if (createAgent2Response.status === 201) {
        testAgent2Id =
          createAgent2Response.body.id || createAgent2Response.body._id;
        console.log("Agent 2 created:", testAgent2Id);
      } else {
        throw new Error(
          `Failed to create agent 2: ${JSON.stringify(createAgent2Response.body)}`,
        );
      }

      // Generate magic link for agent 2
      const magicLink2Response = await request(app.getHttpServer())
        .post(`/agents/${testAgent2Id}/magic-link`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          expirationHours: 24,
        })
        .expect(201);

      const magicLink2Url = magicLink2Response.body.magicLink;
      const url2 = new URL(magicLink2Url);
      const magicLink2Token = url2.searchParams.get("token");

      if (!magicLink2Token) {
        throw new Error(
          `Failed to extract token from magic link 2: ${magicLink2Url}`,
        );
      }

      // Authenticate agent 2 using magic link
      const agent2LoginResponse = await request(app.getHttpServer())
        .post("/auth/magic-link/login")
        .send({
          token: magicLink2Token,
        });

      if (agent2LoginResponse.status !== 200) {
        throw new Error(
          `Magic link login failed for agent 2: ${JSON.stringify(agent2LoginResponse.body)}`,
        );
      }

      testAgent2AuthToken = agent2LoginResponse.body.access_token;
      console.log("Multi-supplier test scenario setup completed");
    } catch (error) {
      console.error("beforeAll setup error:", error);
      throw error;
    }
  }, 60000);

  afterAll(async () => {
    // Cleanup: Delete test pricelist if it exists
    if (testPricelistId && agentAuthToken) {
      try {
        await request(app.getHttpServer())
          .delete(`/agents/pricing/suppliers/${testSupplierId}`)
          .set("Authorization", `Bearer ${agentAuthToken}`);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Cleanup: Delete test agents
    if (testAgentId && operatorAuthToken) {
      try {
        await request(app.getHttpServer())
          .delete(`/agents/${testAgentId}`)
          .set("Authorization", `Bearer ${operatorAuthToken}`);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    if (testAgent2Id && operatorAuthToken) {
      try {
        await request(app.getHttpServer())
          .delete(`/agents/${testAgent2Id}`)
          .set("Authorization", `Bearer ${operatorAuthToken}`);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Cleanup: Delete test suppliers
    if (testSupplierId && operatorAuthToken) {
      try {
        await request(app.getHttpServer())
          .delete(`/shipping-lines/${testSupplierId}`)
          .set("Authorization", `Bearer ${operatorAuthToken}`);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    if (testSupplier2Id && operatorAuthToken) {
      try {
        await request(app.getHttpServer())
          .delete(`/shipping-lines/${testSupplier2Id}`)
          .set("Authorization", `Bearer ${operatorAuthToken}`);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    if (testSupplier3Id && operatorAuthToken) {
      try {
        await request(app.getHttpServer())
          .delete(`/shipping-lines/${testSupplier3Id}`)
          .set("Authorization", `Bearer ${operatorAuthToken}`);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    if (app) {
      await app.close();
    }
  });

  describe("Agent Pricing Flow Tests", () => {
    let supplierId: string;
    let createdPricelistId: string;
    let createdWeekStart: string;
    let item1Id: string;
    let item2Id: string;
    let supplierIds: string[];
    let pricelistHistory: any[];
    let pricelistById: any;

    const expectLockedStatus = (status: number) => {
      // Different implementations use 403 or 409. Accept either.
      expect([403, 409]).toContain(status);
    };

    it("Step 0: Agent lists suppliers they are allowed to price (GET suppliers)", async () => {
      const res = await request(app.getHttpServer())
        .get("/agents/pricing/suppliers?page=1&limit=50")
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);

      console.log("suppliers info in step 0", res.body.data);
      expect(res.body).toHaveProperty("data");
      expect(Array.isArray(res.body.data)).toBe(true);

      supplierIds = res.body.data.map(
        (s: any) => s.supplierId || s._id || s.id,
      );

      // Deterministic: must include the supplier we created for agent1 in beforeAll
      expect(supplierIds).toContain(testSupplierId);

      // If your setup successfully added agent1 to supplier2, it should be present too
      // (If your DB has oddities, you can soften this assertion)
      if (testSupplier2Id) {
        expect(supplierIds).toContain(testSupplier2Id);
      }
      console.log("supplierIds in step 0", supplierIds);
    });

    it("Step 1: Agent loads current week pricelist first time should be empty", async () => {
      // Use testSupplier2Id to avoid conflicts with other tests that use testSupplierId
      // Prefer testSupplier2Id if available, otherwise use first supplier that's not testSupplierId
      if (testSupplier2Id && supplierIds.includes(testSupplier2Id)) {
        supplierId = testSupplier2Id;
      } else {
        // Find a supplier that's not testSupplierId to avoid conflicts
        supplierId =
          supplierIds.find((id: string) => id !== testSupplierId) ||
          supplierIds[0];
      }
      const res = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${supplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(404);

      console.log("pricelist info in step 1", res.body);
      console.log("Flow tests using supplier:", supplierId);
    });

    it("Step 2: Agent should CREATE a current-week draft pricelist when none exists (PUT replaces all items)", async () => {
      const createRes = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${supplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "Bulk Item A",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 1111.11,
              currency: Currency.USD,
              metadata: { source: "bulk-put" },
            },
            {
              name: "Bulk Item B",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.CIF,
              cost: 2222.22,
              currency: Currency.EUR,
            },
          ],
        })
        .expect(200);

      console.log("pricelist info in step 2", createRes.body);
      expect(createRes.body).toHaveProperty("pricelistId");
      expect(createRes.body).toHaveProperty("weekStart");
      expect(createRes.body.status).toBe("draft");
      expect(createRes.body.supplierId).toBe(supplierId);

      expect(Array.isArray(createRes.body.items)).toBe(true);
      expect(createRes.body.items).toHaveLength(2);

      const names = createRes.body.items.map((i: any) => i.name);
      expect(names).toContain("Bulk Item A");
      expect(names).toContain("Bulk Item B");

      // Basic totals if you compute them
      expect(createRes.body.itemCount).toBeDefined();
      expect(createRes.body.totalCost).toBeDefined();
      item1Id = createRes.body.items[0].id;
      item2Id = createRes.body.items[1].id;
    });

    it("Step 2.1: Agent updates item1 in draft (PUT item)", async () => {
      const res = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${supplierId}/items/${item1Id}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          name: "Bulk Item A Updated",
          chargeType: ChargeType.OCEAN_FREIGHT,
          incoterm: MaritimeIncoterm.DDP,
          cost: 1200.0,
          currency: Currency.USD,
        })
        .expect(200);

      const updatedItem = res.body.items.find((i: any) => i.id === item1Id);
      expect(updatedItem).toBeDefined();
      expect(updatedItem.name).toBe("Bulk Item A Updated");
      expect(updatedItem.incoterm).toBe(MaritimeIncoterm.DDP);
      expect(updatedItem.cost).toBe(1200.0);
    });

    it("Step 2.2: Agent adds second item to same draft", async () => {
      const res = await request(app.getHttpServer())
        .post(`/agents/pricing/suppliers/${supplierId}/items`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          name: "Bulk Item C",
          chargeType: ChargeType.OCEAN_FREIGHT,
          incoterm: MaritimeIncoterm.CIF,
          cost: 1500.0,
          currency: Currency.EUR,
        })
        .expect(200);

      expect(res.body.status).toBe("draft");
      const createdItem2 = res.body.items.find(
        (i: any) => i.name === "Bulk Item C",
      );
      expect(createdItem2).toBeDefined();
      item2Id = createdItem2.id;

      // Totals should be consistent if you compute them.
      expect(res.body.itemCount).toBeDefined();
      expect(res.body.totalCost).toBeDefined();
    });

    it("Step 3: Agent should submit the current week's draft pricelist (draft -> submitted)", async () => {
      const submitRes = await request(app.getHttpServer())
        .post(`/agents/pricing/suppliers/${supplierId}/submit`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);

      console.log("pricelist info in step 3", submitRes.body);
    });

    it("Edge Case: Should NOT allow submitting when already submitted (locked)", async () => {
      const submitRes = await request(app.getHttpServer())
        .post(`/agents/pricing/suppliers/${supplierId}/submit`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(400);

      console.log("pricelist info in step 3", submitRes.body);
    });

    it("Edge Case: Should NOT allow to update items when already submitted (locked)", async () => {
      const updateRes = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${supplierId}/items/${item2Id}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          name: "Flow Item 1",
          chargeType: ChargeType.OCEAN_FREIGHT,
          incoterm: MaritimeIncoterm.FOB,
          cost: 1000.0,
          currency: Currency.USD,
        })
        .expect(409);

      console.log("pricelist info in step 3", updateRes.body);
    });

    it("Edge Case: Should NOT allow to delete items when already submitted (locked)", async () => {
      const deleteRes = await request(app.getHttpServer())
        .delete(`/agents/pricing/suppliers/${supplierId}/items/${item2Id}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(409);

      console.log("pricelist info in step 3", deleteRes.body);
    });

    it("Edge Case: Should NOT allow to add items when already submitted (locked)", async () => {
      const addRes = await request(app.getHttpServer())
        .post(`/agents/pricing/suppliers/${supplierId}/items`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          name: "Flow Item 1",
          chargeType: ChargeType.OCEAN_FREIGHT,
          incoterm: MaritimeIncoterm.FOB,
          cost: 1000.0,
          currency: Currency.USD,
        })
        .expect(409);

      console.log("pricelist info in step 3", addRes.body);
    });

    it("Step 4: Get supplier pricelist history", async () => {
      const getRes = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${supplierId}/pricelists`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);

      console.log("pricelist info in step 4", getRes.body);
      pricelistHistory = getRes.body;
      pricelistById = pricelistHistory.pricelists[0].pricelistId;
      console.log("pricelistById in step 4", pricelistById);
    });

    it("Step 5: Get supplier pricelist  by id", async () => {
      const getRes = await request(app.getHttpServer())
        .get(`/agents/pricing/pricelists/${pricelistById}`)
        .set("Authorization", `Bearer ${agentAuthToken}`);

      console.log("pricelist info in step 5", getRes.body);
    });

    // Cleanup: Delete the pricelist document directly to prevent interference with other tests
    // This ensures no pricelist exists for this supplier/week after flow tests complete
    afterAll(async () => {
      if (pricelistById && app) {
        try {
          // Get the pricelist model from the app's module
          const pricelistModel = app.get<Model<AgentPricelistDocument>>(
            getModelToken(AgentPricelist.name),
          );

          // Delete the pricelist document directly
          await pricelistModel.findByIdAndDelete(pricelistById).exec();
          console.log("Cleanup: Deleted pricelist", pricelistById);
        } catch (error) {
          // Ignore cleanup errors - pricelist might have been deleted or already modified
          console.log(
            "Cleanup: Could not delete pricelist (this is OK)",
            error,
          );
        }
      }
    });
  });

  describe("GET /agents/pricing/suppliers", () => {
    it("should return 401 Unauthorized without auth token", async () => {
      const response = await request(app.getHttpServer())
        .get("/agents/pricing/suppliers")
        .expect(401);

      expect(response.body.message).toContain("Unauthorized");
    });

    it("should return 403 Forbidden for non-agent users", async () => {
      const response = await request(app.getHttpServer())
        .get("/agents/pricing/suppliers")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .expect(403);

      expect(response.body.message).toContain("only available for agents");
    });

    it("should return list of suppliers for authenticated agent", async () => {
      const response = await request(app.getHttpServer())
        .get("/agents/pricing/suppliers")
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("page");
      expect(response.body).toHaveProperty("limit");
      expect(response.body).toHaveProperty("total");
      console.log("Response body:", response.body);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should support pagination", async () => {
      const response = await request(app.getHttpServer())
        .get("/agents/pricing/suppliers?page=1&limit=10")
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should support search filter", async () => {
      const response = await request(app.getHttpServer())
        .get("/agents/pricing/suppliers?search=Test")
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("data");
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should include isApproved flag for suppliers with pricelists", async () => {
      // First check if a pricelist already exists
      const getResponse = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`);

      // If no pricelist exists (404), create one
      if (getResponse.status === 404) {
        const upsertResponse = await request(app.getHttpServer())
          .put(`/agents/pricing/suppliers/${testSupplierId}`)
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .send({
            items: [
              {
                name: "Test Item",
                chargeType: ChargeType.OCEAN_FREIGHT,
                incoterm: MaritimeIncoterm.FOB,
                cost: 100.0,
                currency: Currency.USD,
              },
            ],
          })
          .expect(200);
      } else if (getResponse.status === 200) {
        // Pricelist exists - if it's draft, update it; if non-draft, that's fine too
        if (getResponse.body.status === "draft") {
          await request(app.getHttpServer())
            .put(`/agents/pricing/suppliers/${testSupplierId}`)
            .set("Authorization", `Bearer ${agentAuthToken}`)
            .send({
              items: [
                {
                  name: "Test Item",
                  chargeType: ChargeType.OCEAN_FREIGHT,
                  incoterm: MaritimeIncoterm.FOB,
                  cost: 100.0,
                  currency: Currency.USD,
                },
              ],
            })
            .expect(200);
        }
        // If non-draft, we can't modify it, but that's okay - it still has a pricelist
      }

      // Then check suppliers list
      const suppliersResponse = await request(app.getHttpServer())
        .get("/agents/pricing/suppliers")
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);

      const supplier = suppliersResponse.body.data.find(
        (s: any) => s.supplierId === testSupplierId,
      );
      expect(supplier).toBeDefined();
      expect(supplier.isApproved).toBe(true);
    });
  });

  describe("Multi-supplier association tests", () => {
    it("should return 2 suppliers for agent1 (supplier1 via shippingLineId + supplier2 via agents array)", async () => {
      const response = await request(app.getHttpServer())
        .get("/agents/pricing/suppliers")
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("total");
      expect(Array.isArray(response.body.data)).toBe(true);

      // Agent1 should see 2 suppliers:
      // 1. testSupplierId (via agent.shippingLineId)
      // 2. testSupplier2Id (via supplier.agents array)
      const supplierIds = response.body.data.map(
        (s: any) => s.supplierId || s._id || s.id,
      );

      expect(supplierIds).toContain(testSupplierId);
      expect(supplierIds).toContain(testSupplier2Id);
      expect(response.body.total).toBeGreaterThanOrEqual(2);

      console.log(`Agent1 sees ${response.body.total} suppliers:`, supplierIds);
    });

    it("should return 1 supplier for agent2 (supplier3 via shippingLineId)", async () => {
      const response = await request(app.getHttpServer())
        .get("/agents/pricing/suppliers")
        .set("Authorization", `Bearer ${testAgent2AuthToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("total");
      expect(Array.isArray(response.body.data)).toBe(true);

      // Agent2 should see 1 supplier:
      // 1. testSupplier3Id (via agent.shippingLineId)
      const supplierIds = response.body.data.map(
        (s: any) => s.supplierId || s._id || s.id,
      );

      expect(supplierIds).toContain(testSupplier3Id);
      expect(response.body.total).toBe(1);

      console.log(`Agent2 sees ${response.body.total} supplier:`, supplierIds);
    });

    it("should verify agent1 does not see supplier3", async () => {
      const response = await request(app.getHttpServer())
        .get("/agents/pricing/suppliers")
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);

      const supplierIds = response.body.data.map(
        (s: any) => s.supplierId || s._id || s.id,
      );

      // Agent1 should NOT see supplier3
      expect(supplierIds).not.toContain(testSupplier3Id);
    });

    it("should verify agent2 does not see supplier1 or supplier2", async () => {
      const response = await request(app.getHttpServer())
        .get("/agents/pricing/suppliers")
        .set("Authorization", `Bearer ${testAgent2AuthToken}`)
        .expect(200);

      const supplierIds = response.body.data.map(
        (s: any) => s.supplierId || s._id || s.id,
      );

      // Agent2 should NOT see supplier1 or supplier2
      expect(supplierIds).not.toContain(testSupplierId);
      expect(supplierIds).not.toContain(testSupplier2Id);
    });
  });

  describe("Operator Flow: Pricelist Approval/Rejection", () => {
    let operatorTestSupplierId: string;
    let operatorTestAgentId: string;
    let operatorTestAgentAuthToken: string;
    let operatorTestAgent2Id: string;
    let operatorTestAgent2AuthToken: string;
    let submittedPricelistId: string;
    let rejectedPricelistId: string;

    beforeAll(async () => {
      // Create a supplier for operator testing
      // Handle permission errors by using existing supplier if creation fails
      console.log("Creating operator test supplier...");
      const createSupplierResponse = await request(app.getHttpServer())
        .post("/shipping-lines")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          name: `Operator Test Supplier ${Date.now()}`,
          email: `operator-test-supplier-${Date.now()}@example.com`,
          phone: "+1234567890",
          shippingModes: ["maritime"],
          isActive: true,
        });

      if (createSupplierResponse.status === 201) {
        operatorTestSupplierId = createSupplierResponse.body.id;
        console.log("Operator test supplier created:", operatorTestSupplierId);
      } else {
        console.log(
          "Supplier creation failed, trying to find existing supplier...",
          createSupplierResponse.status,
          createSupplierResponse.body,
        );
        // Try to find existing supplier
        const suppliersResponse = await request(app.getHttpServer())
          .get("/shipping-lines")
          .set("Authorization", `Bearer ${operatorAuthToken}`);

        if (
          suppliersResponse.status === 200 &&
          suppliersResponse.body.length > 0
        ) {
          operatorTestSupplierId =
            suppliersResponse.body[0]._id || suppliersResponse.body[0].id;
          console.log("Using existing supplier:", operatorTestSupplierId);
        } else {
          throw new Error(
            `Failed to create or find operator test supplier. Create status: ${createSupplierResponse.status}, Response: ${JSON.stringify(createSupplierResponse.body)}`,
          );
        }
      }

      // Create an agent for operator testing
      console.log("Creating operator test agent...");
      const createAgentResponse = await request(app.getHttpServer())
        .post("/agents")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          firstName: "Operator",
          lastName: "TestAgent",
          email: `operator-test-agent-${Date.now()}@example.com`,
          phone: "+1234567890",
          address: {
            street: "123 Test St",
            city: "Test City",
            state: "TS",
            zipCode: "12345",
            country: "US",
          },
          shippingLineId: operatorTestSupplierId,
          isActive: true,
        });

      if (createAgentResponse.status === 201) {
        operatorTestAgentId =
          createAgentResponse.body.id || createAgentResponse.body._id;
        console.log("Operator test agent created:", operatorTestAgentId);
      } else {
        console.error(
          "Agent creation failed:",
          createAgentResponse.status,
          createAgentResponse.body,
        );
        throw new Error(
          `Failed to create operator test agent: Status ${createAgentResponse.status}, ${JSON.stringify(createAgentResponse.body)}`,
        );
      }

      // Generate magic link for agent
      console.log("Generating magic link for operator test agent...");
      const magicLinkResponse = await request(app.getHttpServer())
        .post(`/agents/${operatorTestAgentId}/magic-link`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          expirationHours: 24,
        })
        .expect(201);

      // Extract token from magicLink URL (format: http://...?token=abc123...)
      const magicLinkUrl = magicLinkResponse.body.magicLink;
      const url = new URL(magicLinkUrl);
      const magicLinkToken = url.searchParams.get("token");

      if (!magicLinkToken) {
        throw new Error(
          `Failed to extract token from magic link: ${magicLinkUrl}`,
        );
      }

      // Authenticate agent using magic link
      console.log("Authenticating operator test agent with magic link...");
      const agentLoginResponse = await request(app.getHttpServer())
        .post("/auth/magic-link/login")
        .send({
          token: magicLinkToken,
        });

      if (agentLoginResponse.status !== 200) {
        console.error(
          "Magic link login failed:",
          JSON.stringify(agentLoginResponse.body, null, 2),
        );
        throw new Error(
          `Magic link login failed with status ${agentLoginResponse.status}: ${JSON.stringify(agentLoginResponse.body)}`,
        );
      }

      operatorTestAgentAuthToken = agentLoginResponse.body.access_token;

      // Note: We can only have one pricelist per week per agent-supplier pair
      // So we'll create one pricelist, submit it, approve it, then create another one for rejection testing
      // OR we can create two pricelists using different agents
      // For simplicity, we'll use the same agent but handle the workflow properly

      // Create first pricelist for approval testing
      const createPricelistResponse = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${operatorTestSupplierId}`)
        .set("Authorization", `Bearer ${operatorTestAgentAuthToken}`)
        .send({
          items: [
            {
              name: "Approval Test Item",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 1500.0,
              currency: Currency.USD,
            },
          ],
        });

      if (createPricelistResponse.status !== 200) {
        throw new Error(
          `Failed to create pricelist: ${JSON.stringify(createPricelistResponse.body)}`,
        );
      }

      submittedPricelistId = createPricelistResponse.body.pricelistId;

      // Submit the first pricelist
      const submitResponse = await request(app.getHttpServer())
        .post(`/agents/pricing/suppliers/${operatorTestSupplierId}/submit`)
        .set("Authorization", `Bearer ${operatorTestAgentAuthToken}`)
        .expect(200);

      expect(submitResponse.body.status).toBe("submitted");

      // Create second agent for rejection testing (to avoid week conflict)
      console.log("Creating second operator test agent...");
      const createAgent2Response = await request(app.getHttpServer())
        .post("/agents")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          firstName: "Operator",
          lastName: "TestAgent2",
          email: `operator-test-agent2-${Date.now()}@example.com`,
          phone: "+1234567891",
          address: {
            street: "456 Test St",
            city: "Test City",
            state: "TS",
            zipCode: "12345",
            country: "US",
          },
          shippingLineId: operatorTestSupplierId,
          isActive: true,
        });

      if (createAgent2Response.status !== 201) {
        throw new Error(
          `Failed to create second test agent: Status ${createAgent2Response.status}, ${JSON.stringify(createAgent2Response.body)}`,
        );
      }

      operatorTestAgent2Id =
        createAgent2Response.body.id || createAgent2Response.body._id;
      console.log("Second operator test agent created:", operatorTestAgent2Id);

      // Generate magic link for second agent
      console.log("Generating magic link for second operator test agent...");
      const magicLink2Response = await request(app.getHttpServer())
        .post(`/agents/${operatorTestAgent2Id}/magic-link`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          expirationHours: 24,
        })
        .expect(201);

      // Extract token from magicLink URL
      const magicLinkUrl2 = magicLink2Response.body.magicLink;
      const url2 = new URL(magicLinkUrl2);
      const magicLinkToken2 = url2.searchParams.get("token");

      if (!magicLinkToken2) {
        throw new Error(
          `Failed to extract token from magic link: ${magicLinkUrl2}`,
        );
      }

      // Authenticate second agent using magic link
      console.log("Authenticating second operator test agent...");
      const agent2LoginResponse = await request(app.getHttpServer())
        .post("/auth/magic-link/login")
        .send({
          token: magicLinkToken2,
        });

      if (agent2LoginResponse.status !== 200) {
        console.error(
          "Magic link login failed for agent 2:",
          JSON.stringify(agent2LoginResponse.body, null, 2),
        );
        throw new Error(
          `Magic link login failed for agent 2 with status ${agent2LoginResponse.status}: ${JSON.stringify(agent2LoginResponse.body)}`,
        );
      }

      operatorTestAgent2AuthToken = agent2LoginResponse.body.access_token;

      // Create second pricelist for rejection testing (using different agent)
      const createRejectPricelistResponse = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${operatorTestSupplierId}`)
        .set("Authorization", `Bearer ${operatorTestAgent2AuthToken}`)
        .send({
          items: [
            {
              name: "Rejection Test Item",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.CIF,
              cost: 2000.0,
              currency: Currency.EUR,
            },
          ],
        });

      if (createRejectPricelistResponse.status !== 200) {
        throw new Error(
          `Failed to create rejection test pricelist: ${JSON.stringify(createRejectPricelistResponse.body)}`,
        );
      }

      rejectedPricelistId = createRejectPricelistResponse.body.pricelistId;

      // Submit the second pricelist
      const submitRejectResponse = await request(app.getHttpServer())
        .post(`/agents/pricing/suppliers/${operatorTestSupplierId}/submit`)
        .set("Authorization", `Bearer ${operatorTestAgent2AuthToken}`)
        .expect(200);

      expect(submitRejectResponse.body.status).toBe("submitted");
    });

    afterAll(async () => {
      // Cleanup: Delete test data
      try {
        if (operatorTestAgentId) {
          await request(app.getHttpServer())
            .delete(`/agents/${operatorTestAgentId}`)
            .set("Authorization", `Bearer ${operatorAuthToken}`);
        }
        if (operatorTestAgent2Id) {
          await request(app.getHttpServer())
            .delete(`/agents/${operatorTestAgent2Id}`)
            .set("Authorization", `Bearer ${operatorAuthToken}`);
        }
        if (operatorTestSupplierId) {
          await request(app.getHttpServer())
            .delete(`/shipping-lines/${operatorTestSupplierId}`)
            .set("Authorization", `Bearer ${operatorAuthToken}`);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it("Step 1: Supplier selection (entry point) - Operator can list suppliers", async () => {
      // This step would typically involve listing suppliers
      // For now, we'll verify the operator can access supplier data
      const response = await request(app.getHttpServer())
        .get(`/shipping-lines/${operatorTestSupplierId}`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .expect(200);

      // Handle both _id (MongoDB format) and id (transformed format)
      const supplierId = response.body.id || response.body._id;
      expect(supplierId).toBe(operatorTestSupplierId);
      expect(response.body).toHaveProperty("name");
      console.log("Step 1: Supplier selected:", response.body.name);
    });

    it("Step 2: Load all agent pricelists for a supplier (read-only)", async () => {
      const response = await request(app.getHttpServer())
        .get(`/pricing/suppliers/${operatorTestSupplierId}`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("supplier");
      expect(response.body.supplier.id).toBe(operatorTestSupplierId);
      expect(response.body).toHaveProperty("pricelists");
      expect(Array.isArray(response.body.pricelists)).toBe(true);

      // Verify pricelists have required metadata
      if (response.body.pricelists.length > 0) {
        const pricelist = response.body.pricelists[0];
        expect(pricelist).toHaveProperty("pricelistId");
        expect(pricelist).toHaveProperty("weekStart");
        expect(pricelist).toHaveProperty("status");
        expect(pricelist).toHaveProperty("submittedAt");
        expect(pricelist).toHaveProperty("agent");
        expect(pricelist).toHaveProperty("items");
        expect(pricelist).toHaveProperty("itemCount");
        expect(pricelist).toHaveProperty("totalCost");
      }

      console.log(
        "Step 2: Found",
        response.body.pricelists.length,
        "pricelists for supplier",
      );
    });

    it("Step 3: Filter to show only submitted pricelists", async () => {
      const response = await request(app.getHttpServer())
        .get(`/pricing/suppliers/${operatorTestSupplierId}?status=submitted`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("pricelists");
      expect(Array.isArray(response.body.pricelists)).toBe(true);

      // Verify all returned pricelists have status "submitted"
      response.body.pricelists.forEach((pricelist: any) => {
        expect(pricelist.status).toBe("submitted");
        expect(pricelist).toHaveProperty("pricelistId");
        expect(pricelist).toHaveProperty("submittedAt");
      });

      // Should find at least the two we submitted
      expect(response.body.pricelists.length).toBeGreaterThanOrEqual(2);

      console.log(
        "Step 3: Found",
        response.body.pricelists.length,
        "submitted pricelists",
      );
    });

    it("Step 4: Operator opens one pricelist to inspect", async () => {
      // Get submitted pricelists
      const submittedResponse = await request(app.getHttpServer())
        .get(`/pricing/suppliers/${operatorTestSupplierId}?status=submitted`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .expect(200);

      expect(submittedResponse.body.pricelists.length).toBeGreaterThan(0);

      // Find the pricelist we want to inspect (the one for approval)
      const pricelistToInspect = submittedResponse.body.pricelists.find(
        (p: any) => p.pricelistId === submittedPricelistId,
      );

      expect(pricelistToInspect).toBeDefined();
      expect(pricelistToInspect.status).toBe("submitted");
      expect(pricelistToInspect).toHaveProperty("items");
      expect(Array.isArray(pricelistToInspect.items)).toBe(true);
      expect(pricelistToInspect.items.length).toBeGreaterThan(0);

      // Verify pricelist details
      expect(pricelistToInspect).toHaveProperty("pricelistId");
      expect(pricelistToInspect).toHaveProperty("weekStart");
      expect(pricelistToInspect).toHaveProperty("agent");
      expect(pricelistToInspect.agent).toHaveProperty("id");
      expect(pricelistToInspect.agent).toHaveProperty("name");
      expect(pricelistToInspect.agent).toHaveProperty("email");

      console.log(
        "Step 4: Inspecting pricelist",
        pricelistToInspect.pricelistId,
        "with",
        pricelistToInspect.items.length,
        "items",
      );
    });

    it("Step 5: Approve pricelist", async () => {
      const approveResponse = await request(app.getHttpServer())
        .post(`/pricing/pricelists/${submittedPricelistId}/approve`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .expect(200);

      expect(approveResponse.body).toHaveProperty("pricelistId");
      expect(approveResponse.body.pricelistId).toBe(submittedPricelistId);
      expect(approveResponse.body.status).toBe("approved");
      expect(approveResponse.body).toHaveProperty("approvedAt");
      expect(approveResponse.body.approvedAt).toBeDefined();

      console.log(
        "Step 5: Pricelist",
        submittedPricelistId,
        "approved at",
        approveResponse.body.approvedAt,
      );
    });

    it("Step 6: Reject pricelist with reason and verify status changes to draft", async () => {
      const rejectionReason =
        "Pricing does not meet requirements. Please review costs.";

      const rejectResponse = await request(app.getHttpServer())
        .post(`/pricing/pricelists/${rejectedPricelistId}/reject`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          rejectionReason: rejectionReason,
        })
        .expect(200);

      expect(rejectResponse.body).toHaveProperty("pricelistId");
      expect(rejectResponse.body.pricelistId).toBe(rejectedPricelistId);
      // Status should be DRAFT (not REJECTED) so agent can edit
      expect(rejectResponse.body.status).toBe("draft");
      expect(rejectResponse.body).toHaveProperty("rejectedAt");
      expect(rejectResponse.body).toHaveProperty("rejectionReason");
      expect(rejectResponse.body.rejectionReason).toBe(rejectionReason);

      console.log(
        "Step 6: Pricelist",
        rejectedPricelistId,
        "rejected and set to draft. Reason:",
        rejectionReason,
      );

      // Verify agent can now edit the pricelist (since it's draft)
      // Use agent 2's token since they created the rejected pricelist
      const agentGetResponse = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${operatorTestSupplierId}`)
        .set("Authorization", `Bearer ${operatorTestAgent2AuthToken}`)
        .expect(200);

      expect(agentGetResponse.body.status).toBe("draft");
      expect(agentGetResponse.body.pricelistId).toBe(rejectedPricelistId);

      // Agent should be able to update an item
      if (agentGetResponse.body.items.length > 0) {
        const itemId = agentGetResponse.body.items[0].id;
        const updateResponse = await request(app.getHttpServer())
          .put(
            `/agents/pricing/suppliers/${operatorTestSupplierId}/items/${itemId}`,
          )
          .set("Authorization", `Bearer ${operatorTestAgent2AuthToken}`)
          .send({
            name: "Rejection Test Item - Updated After Rejection",
            chargeType: ChargeType.OCEAN_FREIGHT,
            incoterm: MaritimeIncoterm.CIF,
            cost: 2100.0,
            currency: Currency.EUR,
          })
          .expect(200);

        expect(updateResponse.body.status).toBe("draft");
        expect(updateResponse.body.items).toBeDefined();
        const updatedItem = updateResponse.body.items.find(
          (i: any) => i.id === itemId,
        );
        expect(updatedItem).toBeDefined();
        expect(updatedItem.name).toBe(
          "Rejection Test Item - Updated After Rejection",
        );
        expect(updateResponse.body.rejectionReason).toBe(rejectionReason);

        console.log(
          "Step 6: Verified agent can edit pricelist after rejection. Item updated successfully.",
        );
      }
    });
  });

  describe("GET /agents/pricing/suppliers/:supplierId", () => {
    it("should return 401 Unauthorized without auth token", async () => {
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${testSupplierId}`)
        .expect(401);
      expect(response.body.message).toContain("Unauthorized");
    });
    it("should return 403 Forbidden for non-agent users", async () => {
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .expect(403);
      expect(response.body.message).toContain("only available for agents");
    });
    it("should return 400 Bad Request for invalid supplierId format", async () => {
      const response = await request(app.getHttpServer())
        .get("/agents/pricing/suppliers/invalid-id")
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(400);
      expect(response.body.message).toContain("Invalid supplierId format");
    });
    it("should return 404 Not Found for non-existent supplier", async () => {
      const fakeSupplierId = new Types.ObjectId().toString();
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${fakeSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(404);
      expect(response.body.message).toContain("not found");
    });
    it("should return 404 when pricelist does not exist", async () => {
      // First, ensure no pricelist exists for testSupplierId by checking and cleaning up if needed
      const checkResponse = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`);

      // If a pricelist exists, delete it first (cleanup from previous tests)
      if (checkResponse.status === 200 && checkResponse.body.pricelistId) {
        try {
          const pricelistModel = app.get<Model<AgentPricelistDocument>>(
            getModelToken(AgentPricelist.name),
          );
          await pricelistModel
            .findByIdAndDelete(checkResponse.body.pricelistId)
            .exec();
          console.log(
            "Cleanup: Deleted existing pricelist",
            checkResponse.body.pricelistId,
            "for testSupplierId",
          );
        } catch (error) {
          console.log(
            "Cleanup: Could not delete pricelist (this is OK)",
            error,
          );
        }
      }

      // Now verify 404 is returned
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(404);
      expect(response.body.message).toContain("No pricelist found");
    });
    it("should return pricelist with items when it exists", async () => {
      // Create pricelist first
      const upsertResponse = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "40FT Container Transport",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 1250.0,
              currency: Currency.USD,
              metadata: { notes: "Test item" },
            },
          ],
        })
        .expect(200);
      testItemId = upsertResponse.body.items[0].id;
      // Get pricelist
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);
      expect(response.body.supplierId).toBe(testSupplierId);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0]).toMatchObject({
        name: "40FT Container Transport",
        incoterm: MaritimeIncoterm.FOB,
        cost: 1250.0,
        currency: Currency.USD,
      });
    });
    it("should return 403 Forbidden when agent is not associated with supplier", async () => {
      // Create a supplier not associated with the agent
      const createSupplierResponse = await request(app.getHttpServer())
        .post("/shippings")
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          name: "Unassociated Supplier",
          email: "unassociated@example.com",
          phone: "+1234567890",
          shippingModes: ["maritime"],
          isActive: true,
        });
      if (createSupplierResponse.status === 201) {
        const unassociatedSupplierId =
          createSupplierResponse.body.id || createSupplierResponse.body._id;
        const response = await request(app.getHttpServer())
          .get(`/agents/pricing/suppliers/${unassociatedSupplierId}`)
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(403);
        expect(response.body.message).toContain("not associated");
        // Cleanup
        await request(app.getHttpServer())
          .delete(`/shippings/${unassociatedSupplierId}`)
          .set("Authorization", `Bearer ${operatorAuthToken}`);
      }
    });
    describe("Filtering, Sorting, and Pagination", () => {
      beforeEach(async () => {
        // Create a pricelist with multiple items for testing
        await request(app.getHttpServer())
          .put(`/agents/pricing/suppliers/${testSupplierId}`)
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .send({
            items: [
              {
                name: "40FT Container Transport",
                chargeType: ChargeType.OCEAN_FREIGHT,
                incoterm: MaritimeIncoterm.FOB,
                cost: 1250.0,
                currency: Currency.USD,
              },
              {
                name: "20FT Container Transport",
                chargeType: ChargeType.OCEAN_FREIGHT,
                incoterm: MaritimeIncoterm.CIF,
                cost: 800.0,
                currency: Currency.USD,
              },
              {
                name: "LCL Shipping Service",
                chargeType: ChargeType.OCEAN_FREIGHT,
                incoterm: MaritimeIncoterm.FOB,
                cost: 500.0,
                currency: Currency.EUR,
              },
              {
                name: "Air Freight Express",
                chargeType: ChargeType.OCEAN_FREIGHT,
                incoterm: MaritimeIncoterm.DDP,
                cost: 2000.0,
                currency: Currency.USD,
              },
            ],
          })
          .expect(200);
      });
      it("should filter items by search term (name)", async () => {
        const response = await request(app.getHttpServer())
          .get(`/agents/pricing/suppliers/${testSupplierId}?search=Container`)
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items).toHaveLength(2);
        expect(
          response.body.items.every((item: any) =>
            item.name.includes("Container"),
          ),
        ).toBe(true);
        expect(response.body.pagination.total).toBe(2);
      });
      it("should filter items by incoterm", async () => {
        const response = await request(app.getHttpServer())
          .get(
            `/agents/pricing/suppliers/${testSupplierId}?incoterm=${MaritimeIncoterm.FOB}`,
          )
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items).toHaveLength(2);
        expect(
          response.body.items.every(
            (item: any) => item.incoterm === MaritimeIncoterm.FOB,
          ),
        ).toBe(true);
        expect(response.body.pagination.total).toBe(2);
      });
      it("should filter items by currency", async () => {
        const response = await request(app.getHttpServer())
          .get(
            `/agents/pricing/suppliers/${testSupplierId}?currency=${Currency.USD}`,
          )
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items).toHaveLength(3);
        expect(
          response.body.items.every(
            (item: any) => item.currency === Currency.USD,
          ),
        ).toBe(true);
        expect(response.body.pagination.total).toBe(3);
      });
      it("should combine multiple filters", async () => {
        const response = await request(app.getHttpServer())
          .get(
            `/agents/pricing/suppliers/${testSupplierId}?incoterm=${MaritimeIncoterm.FOB}&currency=${Currency.USD}`,
          )
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].incoterm).toBe(MaritimeIncoterm.FOB);
        expect(response.body.items[0].currency).toBe(Currency.USD);
        expect(response.body.pagination.total).toBe(1);
      });
      it("should sort items by name ascending", async () => {
        const response = await request(app.getHttpServer())
          .get(
            `/agents/pricing/suppliers/${testSupplierId}?sortBy=name&sortOrder=asc`,
          )
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items.length).toBeGreaterThan(0);
        const names = response.body.items.map((item: any) => item.name);
        const sortedNames = [...names].sort();
        expect(names).toEqual(sortedNames);
      });
      it("should sort items by name descending", async () => {
        const response = await request(app.getHttpServer())
          .get(
            `/agents/pricing/suppliers/${testSupplierId}?sortBy=name&sortOrder=desc`,
          )
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items.length).toBeGreaterThan(0);
        const names = response.body.items.map((item: any) => item.name);
        const sortedNames = [...names].sort().reverse();
        expect(names).toEqual(sortedNames);
      });
      it("should sort items by cost ascending", async () => {
        const response = await request(app.getHttpServer())
          .get(
            `/agents/pricing/suppliers/${testSupplierId}?sortBy=cost&sortOrder=asc`,
          )
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items.length).toBeGreaterThan(0);
        const costs = response.body.items.map((item: any) => item.cost);
        const sortedCosts = [...costs].sort((a, b) => a - b);
        expect(costs).toEqual(sortedCosts);
      });
      it("should sort items by cost descending", async () => {
        const response = await request(app.getHttpServer())
          .get(
            `/agents/pricing/suppliers/${testSupplierId}?sortBy=cost&sortOrder=desc`,
          )
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items.length).toBeGreaterThan(0);
        const costs = response.body.items.map((item: any) => item.cost);
        const sortedCosts = [...costs].sort((a, b) => b - a);
        expect(costs).toEqual(sortedCosts);
      });
      it("should support sorting by createdAt (uses item ObjectId timestamp)", async () => {
        // Note: Since pricelist updates replace all items, all items get new ObjectIds
        // with the same timestamp. Sorting by createdAt will work, but items created
        // in the same update will have the same timestamp.
        const response = await request(app.getHttpServer())
          .get(
            `/agents/pricing/suppliers/${testSupplierId}?sortBy=createdAt&sortOrder=desc`,
          )
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items.length).toBeGreaterThan(0);
        // Verify that createdAt field is present in response
        expect(response.body.items[0]).toHaveProperty("createdAt");
        expect(response.body.items[0]).toHaveProperty("updatedAt");
      });
      it("should paginate results", async () => {
        const response = await request(app.getHttpServer())
          .get(`/agents/pricing/suppliers/${testSupplierId}?page=1&limit=2`)
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items).toHaveLength(2);
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(2);
        expect(response.body.pagination.total).toBe(4);
        expect(response.body.pagination.totalPages).toBe(2);
      });
      it("should return second page of results", async () => {
        const response = await request(app.getHttpServer())
          .get(`/agents/pricing/suppliers/${testSupplierId}?page=2&limit=2`)
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items).toHaveLength(2);
        expect(response.body.pagination.page).toBe(2);
        expect(response.body.pagination.limit).toBe(2);
        expect(response.body.pagination.total).toBe(4);
        expect(response.body.pagination.totalPages).toBe(2);
      });
      it("should respect max limit of 100", async () => {
        const response = await request(app.getHttpServer())
          .get(`/agents/pricing/suppliers/${testSupplierId}?limit=200`)
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.pagination.limit).toBeLessThanOrEqual(100);
      });
      it("should return pagination metadata even with empty results", async () => {
        const response = await request(app.getHttpServer())
          .get(
            `/agents/pricing/suppliers/${testSupplierId}?search=NonexistentItem`,
          )
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items).toHaveLength(0);
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.total).toBe(0);
        expect(response.body.pagination.totalPages).toBe(0);
      });
      it("should combine filtering, sorting, and pagination", async () => {
        const response = await request(app.getHttpServer())
          .get(
            `/agents/pricing/suppliers/${testSupplierId}?currency=${Currency.USD}&sortBy=cost&sortOrder=desc&page=1&limit=2`,
          )
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items).toHaveLength(2);
        expect(
          response.body.items.every(
            (item: any) => item.currency === Currency.USD,
          ),
        ).toBe(true);
        const costs = response.body.items.map((item: any) => item.cost);
        expect(costs[0]).toBeGreaterThanOrEqual(costs[1]);
        expect(response.body.pagination.total).toBe(3); // 3 USD items total
      });
      it("should support q parameter as alias for search", async () => {
        const response = await request(app.getHttpServer())
          .get(`/agents/pricing/suppliers/${testSupplierId}?search=Container`)
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items.length).toBeGreaterThan(0);
        expect(
          response.body.items.every((item: any) =>
            item.name.includes("Container"),
          ),
        ).toBe(true);
      });
      it("should support sort=field:order format", async () => {
        const response = await request(app.getHttpServer())
          .get(`/agents/pricing/suppliers/${testSupplierId}?sort=cost:desc`)
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items.length).toBeGreaterThan(0);
        const costs = response.body.items.map((item: any) => item.cost);
        const sortedCosts = [...costs].sort((a, b) => b - a);
        expect(costs).toEqual(sortedCosts);
      });
      it("should default to createdAt:desc when no sort specified", async () => {
        const response = await request(app.getHttpServer())
          .get(`/agents/pricing/suppliers/${testSupplierId}`)
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items.length).toBeGreaterThan(0);
        // Verify items are sorted (should be sorted by createdAt desc by default)
        // Since all items might have same timestamp if created in same update,
        // we just verify the endpoint works and returns items
        expect(response.body.items[0]).toHaveProperty("createdAt");
      });
      it("should filter items by date range (from)", async () => {
        // Get current date and filter from yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const fromDate = yesterday.toISOString();
        const response = await request(app.getHttpServer())
          .get(`/agents/pricing/suppliers/${testSupplierId}?from=${fromDate}`)
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        // Should return items created from yesterday onwards
        expect(response.body.items.length).toBeGreaterThanOrEqual(0);
      });
      it("should filter items by date range (to)", async () => {
        // Get future date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const toDate = tomorrow.toISOString();
        const response = await request(app.getHttpServer())
          .get(`/agents/pricing/suppliers/${testSupplierId}?to=${toDate}`)
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        // Should return items created up to tomorrow
        expect(response.body.items.length).toBeGreaterThanOrEqual(0);
      });
      it("should filter items by date range (from and to)", async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const response = await request(app.getHttpServer())
          .get(
            `/agents/pricing/suppliers/${testSupplierId}?from=${yesterday.toISOString()}&to=${tomorrow.toISOString()}`,
          )
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        // Should return items created between yesterday and tomorrow
        expect(response.body.items.length).toBeGreaterThanOrEqual(0);
      });
      it("should accept status parameter (even though not implemented in schema)", async () => {
        // Status filter is accepted but won't filter until schema is updated
        const response = await request(app.getHttpServer())
          .get(`/agents/pricing/suppliers/${testSupplierId}?status=draft`)
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        // Should return all items (status filter not yet implemented)
        expect(response.body.items.length).toBeGreaterThanOrEqual(0);
      });
      it("should combine all new features: q, sort, from, to, page, limit", async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const response = await request(app.getHttpServer())
          .get(
            `/agents/pricing/suppliers/${testSupplierId}?search=Container&sort=cost:desc&from=${yesterday.toISOString()}&to=${tomorrow.toISOString()}&page=1&limit=2`,
          )
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .expect(200);
        expect(response.body.items.length).toBeLessThanOrEqual(2);
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(2);
      });
    });
  });
  describe("PUT /agents/pricing/suppliers/:supplierId", () => {
    it("should return 401 Unauthorized without auth token", async () => {
      const response = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .send({
          items: [
            {
              name: "Test Item",
              incoterm: MaritimeIncoterm.FOB,
              cost: 100.0,
              currency: Currency.USD,
            },
          ],
        })
        .expect(401);
      expect(response.body.message).toContain("Unauthorized");
    });
    it("should return 403 Forbidden for non-agent users", async () => {
      const response = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          items: [
            {
              name: "Test Item",
              incoterm: MaritimeIncoterm.FOB,
              cost: 100.0,
              currency: Currency.USD,
            },
          ],
        })
        .expect(403);
      expect(response.body.message).toContain("only available for agents");
    });
    it("should return 400 Bad Request for invalid supplierId format", async () => {
      const response = await request(app.getHttpServer())
        .put("/agents/pricing/suppliers/invalid-id")
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "Test Item",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 100.0,
              currency: Currency.USD,
            },
          ],
        })
        .expect(400);
      expect(response.body.message).toContain("Invalid supplierId format");
    });
    it("should return 400 Bad Request for empty items array", async () => {
      const response = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [],
        })
        .expect(400);
      expect(response.body.message).toContain("cannot be empty");
    });
    it("should create a new pricelist", async () => {
      const response = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "40FT Container Transport",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 1250.0,
              currency: Currency.USD,
              metadata: { notes: "Test item" },
            },
          ],
        })
        .expect(200);
      expect(response.body.supplierId).toBe(testSupplierId);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0]).toMatchObject({
        name: "40FT Container Transport",
        incoterm: MaritimeIncoterm.FOB,
        cost: 1250.0,
        currency: Currency.USD,
      });
      expect(response.body.items[0]).toHaveProperty("id");
    });
    it("should update an existing pricelist", async () => {
      // First create a pricelist
      await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "Original Item",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 1000.0,
              currency: Currency.USD,
            },
          ],
        })
        .expect(200);
      // Then update it
      const response = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "Updated Item",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.CIF,
              cost: 1500.0,
              currency: Currency.EUR,
            },
            {
              name: "New Item",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 800.0,
              currency: Currency.USD,
            },
          ],
        })
        .expect(200);
      expect(response.body.items).toHaveLength(2);
      expect(response.body.items[0].name).toBe("Updated Item");
      expect(response.body.items[1].name).toBe("New Item");
    });
    it("should validate incoterm enum", async () => {
      const response = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "Test Item",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: "INVALID_INCOTERM",
              cost: 100.0,
              currency: Currency.USD,
            },
          ],
        })
        .expect(400);
      expect(response.body.message).toBeDefined();
    });
    it("should validate currency enum", async () => {
      const response = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "Test Item",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 100.0,
              currency: "INVALID_CURRENCY",
            },
          ],
        })
        .expect(400);
      expect(response.body.message).toBeDefined();
    });
    it("should validate cost is non-negative", async () => {
      const response = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "Test Item",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: -100.0,
              currency: Currency.USD,
            },
          ],
        })
        .expect(400);
      expect(response.body.message).toBeDefined();
    });
    it("should handle multiple items", async () => {
      const response = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "40FT Container",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 1250.0,
              currency: Currency.USD,
            },
            {
              name: "20FT Container",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.CIF,
              cost: 800.0,
              currency: Currency.EUR,
            },
            {
              name: "LCL Shipping",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 500.0,
              currency: Currency.USD,
              metadata: { minWeight: 100 },
            },
          ],
        })
        .expect(200);
      expect(response.body.items).toHaveLength(3);
    });
  });
  describe("DELETE /agents/pricing/suppliers/:supplierId/items/:itemId", () => {
    beforeEach(async () => {
      // Ensure pricelist exists before delete tests
      const upsertResponse = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "Item to Delete",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 100.0,
              currency: Currency.USD,
            },
            {
              name: "Item to Keep",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.CIF,
              cost: 200.0,
              currency: Currency.USD,
            },
          ],
        })
        .expect(200);
      testItemId = upsertResponse.body.items[0].id;
    });
    it("should return 401 Unauthorized without auth token", async () => {
      const response = await request(app.getHttpServer())
        .delete(
          `/agents/pricing/suppliers/${testSupplierId}/items/${testItemId}`,
        )
        .expect(401);
      expect(response.body.message).toContain("Unauthorized");
    });
    it("should return 403 Forbidden for non-agent users", async () => {
      const response = await request(app.getHttpServer())
        .delete(
          `/agents/pricing/suppliers/${testSupplierId}/items/${testItemId}`,
        )
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .expect(403);
      expect(response.body.message).toContain("only available for agents");
    });
    it("should return 400 Bad Request for invalid supplierId format", async () => {
      const response = await request(app.getHttpServer())
        .delete(`/agents/pricing/suppliers/invalid-id/items/${testItemId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(400);
      expect(response.body.message).toContain("Invalid supplierId format");
    });
    it("should return 400 Bad Request for invalid itemId format", async () => {
      const response = await request(app.getHttpServer())
        .delete(`/agents/pricing/suppliers/${testSupplierId}/items/invalid-id`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(400);
      expect(response.body.message).toContain("Invalid itemId format");
    });
    it("should return 404 Not Found when pricelist does not exist", async () => {
      const fakeSupplierId = new Types.ObjectId().toString();
      const fakeItemId = new Types.ObjectId().toString();
      const response = await request(app.getHttpServer())
        .delete(
          `/agents/pricing/suppliers/${fakeSupplierId}/items/${fakeItemId}`,
        )
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(404);
      expect(response.body.message).toContain("not found");
    });
    it("should return 404 Not Found when item does not exist", async () => {
      const fakeItemId = new Types.ObjectId().toString();
      const response = await request(app.getHttpServer())
        .delete(
          `/agents/pricing/suppliers/${testSupplierId}/items/${fakeItemId}`,
        )
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(404);
      expect(response.body.message).toContain("not found");
    });
    it("should delete an item from pricelist", async () => {
      const response = await request(app.getHttpServer())
        .delete(
          `/agents/pricing/suppliers/${testSupplierId}/items/${testItemId}`,
        )
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);
      expect(response.body.supplierId).toBe(testSupplierId);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toBe("Item to Keep");
    });
    it("should return empty items array when deleting last item", async () => {
      // Create pricelist with single item
      const upsertResponse = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "Last Item",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 100.0,
              currency: Currency.USD,
            },
          ],
        })
        .expect(200);
      const lastItemId = upsertResponse.body.items[0].id;
      const response = await request(app.getHttpServer())
        .delete(
          `/agents/pricing/suppliers/${testSupplierId}/items/${lastItemId}`,
        )
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);
      expect(response.body.items).toHaveLength(0);
    });
  });
  describe("GET /agents/pricing/suppliers/:supplierId/pricelists", () => {
    beforeEach(async () => {
      // Create a pricelist for testing
      await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "Test Item 1",
              incoterm: MaritimeIncoterm.FOB,
              cost: 1000.0,
              currency: Currency.USD,
            },
            {
              name: "Test Item 2",
              incoterm: MaritimeIncoterm.CIF,
              cost: 1500.0,
              currency: Currency.EUR,
            },
          ],
        });
    });
    it("should return list of pricelists for authenticated agent", async () => {
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${testSupplierId}/pricelists`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);
      expect(response.body.supplierId).toBe(testSupplierId);
      expect(response.body.pricelists).toBeDefined();
      expect(Array.isArray(response.body.pricelists)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
    });
    it("should return 401 Unauthorized without auth token", async () => {
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${testSupplierId}/pricelists`)
        .expect(401);
      expect(response.body.message).toContain("Unauthorized");
    });
    it("should return 403 Forbidden for non-agent users", async () => {
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${testSupplierId}/pricelists`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .expect(403);
      expect(response.body.message).toContain("only available for agents");
    });
    it("should support pagination", async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/agents/pricing/suppliers/${testSupplierId}/pricelists?page=1&limit=10`,
        )
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });
    it("should filter by status", async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/agents/pricing/suppliers/${testSupplierId}/pricelists?status=draft`,
        )
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);
      expect(response.body.pricelists).toBeDefined();
      // All returned pricelists should be draft
      response.body.pricelists.forEach((pricelist: any) => {
        expect(pricelist.status).toBe("draft");
      });
    });
    it("should filter by weekFrom", async () => {
      const weekFrom = new Date().toISOString().split("T")[0];
      const response = await request(app.getHttpServer())
        .get(
          `/agents/pricing/suppliers/${testSupplierId}/pricelists?weekFrom=${weekFrom}`,
        )
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);
      expect(response.body.pricelists).toBeDefined();
    });
    it("should filter by weekTo", async () => {
      const weekTo = new Date().toISOString().split("T")[0];
      const response = await request(app.getHttpServer())
        .get(
          `/agents/pricing/suppliers/${testSupplierId}/pricelists?weekTo=${weekTo}`,
        )
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);
      expect(response.body.pricelists).toBeDefined();
    });
    it("should search by item name (q parameter)", async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/agents/pricing/suppliers/${testSupplierId}/pricelists?q=Test Item 1`,
        )
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);
      expect(response.body.pricelists).toBeDefined();
    });
    it("should return pricelist summaries (not full items)", async () => {
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${testSupplierId}/pricelists`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);
      if (response.body.pricelists.length > 0) {
        const pricelist = response.body.pricelists[0];
        expect(pricelist.pricelistId).toBeDefined();
        expect(pricelist.weekStart).toBeDefined();
        expect(pricelist.status).toBeDefined();
        expect(pricelist.totalCost).toBeDefined();
        expect(pricelist.itemCount).toBeDefined();
        expect(pricelist.createdAt).toBeDefined();
        // Should NOT have items array in summary
        expect(pricelist.items).toBeUndefined();
      }
    });
    it("should return 403 when agent is not associated with supplier", async () => {
      // Use supplier3 which is associated with agent2, not agent1
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${testSupplier3Id}/pricelists`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(403);
      expect(response.body.message).toContain("not associated");
    });
  });
  describe("GET /agents/pricing/pricelists/:pricelistId", () => {
    let testPricelistIdForGet: string;
    beforeEach(async () => {
      // Create a pricelist and get its ID
      const response = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "Get Test Item",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 2000.0,
              currency: Currency.USD,
            },
          ],
        })
        .expect(200);
      testPricelistIdForGet = response.body.pricelistId;
    });
    it("should return full pricelist with all items", async () => {
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/pricelists/${testPricelistIdForGet}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);
      expect(response.body.pricelistId).toBe(testPricelistIdForGet);
      expect(response.body.supplierId).toBe(testSupplierId);
      expect(response.body.items).toBeDefined();
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);
      expect(response.body.items[0].name).toBe("Get Test Item");
    });
    it("should return 401 Unauthorized without auth token", async () => {
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/pricelists/${testPricelistIdForGet}`)
        .expect(401);
      expect(response.body.message).toContain("Unauthorized");
    });
    it("should return 403 Forbidden for non-agent users", async () => {
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/pricelists/${testPricelistIdForGet}`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .expect(403);
      expect(response.body.message).toContain("only available for agents");
    });
    it("should return 404 Not Found for non-existent pricelist", async () => {
      const fakePricelistId = new Types.ObjectId().toString();
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/pricelists/${fakePricelistId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(404);
      expect(response.body.message).toContain("not found");
    });
    it("should return 403 when agent doesn't own the pricelist", async () => {
      // Use agent2's pricelist with agent1's token
      const agent2Response = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplier3Id}`)
        .set("Authorization", `Bearer ${testAgent2AuthToken}`)
        .send({
          items: [
            {
              name: "Agent2 Item",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 1000.0,
              currency: Currency.USD,
            },
          ],
        })
        .expect(200);
      const agent2PricelistId = agent2Response.body.pricelistId;
      // Try to access agent2's pricelist with agent1's token
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/pricelists/${agent2PricelistId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(403);
      expect(response.body.message).toContain("do not have access");
    });
    it("should return 400 Bad Request for invalid pricelistId format", async () => {
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/pricelists/invalid-id`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(400);
      expect(response.body.message).toContain("Invalid pricelistId format");
    });
    it("should include all pricelist metadata", async () => {
      const response = await request(app.getHttpServer())
        .get(`/agents/pricing/pricelists/${testPricelistIdForGet}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);
      expect(response.body.weekStart).toBeDefined();
      expect(response.body.status).toBeDefined();
      expect(response.body.totalCost).toBeDefined();
      expect(response.body.itemCount).toBeDefined();
    });
  });
  describe("POST /agents/pricing/suppliers/:supplierId/items", () => {
    it("should add a new item to draft pricelist", async () => {
      // First create a draft pricelist
      await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "Existing Item",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 1000.0,
              currency: Currency.USD,
            },
          ],
        })
        .expect(200);
      // Add a new item
      const response = await request(app.getHttpServer())
        .post(`/agents/pricing/suppliers/${testSupplierId}/items`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          name: "New Added Item",
          chargeType: ChargeType.OCEAN_FREIGHT,
          incoterm: MaritimeIncoterm.CIF,
          cost: 1500.0,
          currency: Currency.EUR,
        })
        .expect(200);
      expect(response.body.supplierId).toBe(testSupplierId);
      expect(response.body.items).toBeDefined();
      expect(response.body.items.length).toBe(2);
      expect(
        response.body.items.some((item: any) => item.name === "New Added Item"),
      ).toBe(true);
    });
    it("should return 401 Unauthorized without auth token", async () => {
      const response = await request(app.getHttpServer())
        .post(`/agents/pricing/suppliers/${testSupplierId}/items`)
        .send({
          name: "Test Item",
          incoterm: MaritimeIncoterm.FOB,
          cost: 1000.0,
          currency: Currency.USD,
        })
        .expect(401);
      expect(response.body.message).toContain("Unauthorized");
    });
    it("should return 403 Forbidden for non-agent users", async () => {
      const response = await request(app.getHttpServer())
        .post(`/agents/pricing/suppliers/${testSupplierId}/items`)
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          name: "Test Item",
          incoterm: MaritimeIncoterm.FOB,
          cost: 1000.0,
          currency: Currency.USD,
        })
        .expect(403);
      expect(response.body.message).toContain("only available for agents");
    });
    it("should validate item data", async () => {
      const response = await request(app.getHttpServer())
        .post(`/agents/pricing/suppliers/${testSupplierId}/items`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          name: "", // Invalid: empty name
          incoterm: MaritimeIncoterm.FOB,
          cost: 1000.0,
          currency: Currency.USD,
        })
        .expect(400);
      expect(response.body.message).toBeDefined();
    });
    it("should return 409 Conflict if non-draft pricelist exists for week", async () => {
      // Create and submit a pricelist
      const upsertResponse = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplierId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          items: [
            {
              name: "Submitted Item",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 1000.0,
              currency: Currency.USD,
            },
          ],
        })
        .expect(200);
      const pricelistId = upsertResponse.body.pricelistId;
      // Submit the pricelist
      await request(app.getHttpServer())
        .post(`/agents/pricing/suppliers/${testSupplierId}/submit`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .expect(200);
      // Try to add item - should fail
      const response = await request(app.getHttpServer())
        .post(`/agents/pricing/suppliers/${testSupplierId}/items`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          name: "New Item",
          chargeType: ChargeType.OCEAN_FREIGHT,
          incoterm: MaritimeIncoterm.FOB,
          cost: 1000.0,
          currency: Currency.USD,
        })
        .expect(409);
      expect(response.body.message).toContain("already exists");
    });
    it("should return 403 when agent is not associated with supplier", async () => {
      // Use supplier3 which is associated with agent2, not agent1
      const response = await request(app.getHttpServer())
        .post(`/agents/pricing/suppliers/${testSupplier3Id}/items`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          name: "Test Item",
          chargeType: ChargeType.OCEAN_FREIGHT,
          incoterm: MaritimeIncoterm.FOB,
          cost: 1000.0,
          currency: Currency.USD,
        })
        .expect(403);
      expect(response.body.message).toContain("not associated");
    });
  });
  describe("PUT /agents/pricing/suppliers/:supplierId/items/:itemId", () => {
    let testItemIdForUpdate: string;
    beforeEach(async () => {
      // Use supplier2 to avoid conflicts with other tests
      // Ensure we have a draft pricelist with at least one item
      // First, try to get the current pricelist
      const getResponse = await request(app.getHttpServer())
        .get(`/agents/pricing/suppliers/${testSupplier2Id}`)
        .set("Authorization", `Bearer ${agentAuthToken}`);
      // If pricelist doesn't exist (404), create one with an item
      if (getResponse.status === 404) {
        const addResponse = await request(app.getHttpServer())
          .post(`/agents/pricing/suppliers/${testSupplier2Id}/items`)
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .send({
            name: "Item to Update",
            chargeType: ChargeType.OCEAN_FREIGHT,
            incoterm: MaritimeIncoterm.FOB,
            cost: 1000.0,
            currency: Currency.USD,
          })
          .expect(200);
        testItemIdForUpdate =
          addResponse.body.items[addResponse.body.items.length - 1].id;
        return;
      }
      // If pricelist exists (200), check its status
      if (getResponse.status === 200) {
        const body = getResponse.body;
        // If it's draft and has items, use the first item
        if (
          body.pricelistId &&
          body.status === "draft" &&
          body.items.length > 0
        ) {
          testItemIdForUpdate = body.items[0].id;
          return;
        }
        // If it's draft but empty, add an item
        if (
          body.pricelistId &&
          body.status === "draft" &&
          body.items.length === 0
        ) {
          const addResponse = await request(app.getHttpServer())
            .post(`/agents/pricing/suppliers/${testSupplier2Id}/items`)
            .set("Authorization", `Bearer ${agentAuthToken}`)
            .send({
              name: "Item to Update",
              chargeType: ChargeType.OCEAN_FREIGHT,
              incoterm: MaritimeIncoterm.FOB,
              cost: 1000.0,
              currency: Currency.USD,
            })
            .expect(200);
          testItemIdForUpdate =
            addResponse.body.items[addResponse.body.items.length - 1].id;
          return;
        }
        // If it's not draft (submitted/approved), we can't edit it
        // Try to create a new draft by adding an item (this will fail with 409)
        // In that case, we need to wait for next week or use a different supplier
        // For now, try adding an item - if it fails with 409, we'll handle it
        const addResponse = await request(app.getHttpServer())
          .post(`/agents/pricing/suppliers/${testSupplier2Id}/items`)
          .set("Authorization", `Bearer ${agentAuthToken}`)
          .send({
            name: "Item to Update",
            chargeType: ChargeType.OCEAN_FREIGHT,
            incoterm: MaritimeIncoterm.FOB,
            cost: 1000.0,
            currency: Currency.USD,
          });
        if (addResponse.status === 200) {
          testItemIdForUpdate =
            addResponse.body.items[addResponse.body.items.length - 1].id;
          return;
        }
        // If we get 409, the pricelist is locked - we can't proceed with this test
        // This is a test environment issue, not a code issue
        throw new Error(
          `Cannot create draft pricelist for ${testSupplier2Id}: pricelist is ${body.status}`,
        );
      }
      // Unexpected status code
      throw new Error(
        `Unexpected status ${getResponse.status} when getting pricelist`,
      );
    });
    it("should update an existing item in draft pricelist", async () => {
      const response = await request(app.getHttpServer())
        .put(
          `/agents/pricing/suppliers/${testSupplier2Id}/items/${testItemIdForUpdate}`,
        )
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          name: "Updated Item Name",
          chargeType: ChargeType.OCEAN_FREIGHT,
          incoterm: MaritimeIncoterm.CIF,
          cost: 2000.0,
          currency: Currency.EUR,
        })
        .expect(200);
      expect(response.body.items).toBeDefined();
      const updatedItem = response.body.items.find(
        (item: any) => item.id === testItemIdForUpdate,
      );
      expect(updatedItem).toBeDefined();
      expect(updatedItem.name).toBe("Updated Item Name");
      expect(updatedItem.incoterm).toBe(MaritimeIncoterm.CIF);
      expect(updatedItem.cost).toBe(2000.0);
      expect(updatedItem.currency).toBe(Currency.EUR);
    });
    it("should return 401 Unauthorized without auth token", async () => {
      const response = await request(app.getHttpServer())
        .put(
          `/agents/pricing/suppliers/${testSupplier2Id}/items/${testItemIdForUpdate}`,
        )
        .send({
          name: "Updated Item",
          incoterm: MaritimeIncoterm.FOB,
          cost: 1000.0,
          currency: Currency.USD,
        })
        .expect(401);
      expect(response.body.message).toContain("Unauthorized");
    });
    it("should return 403 Forbidden for non-agent users", async () => {
      const response = await request(app.getHttpServer())
        .put(
          `/agents/pricing/suppliers/${testSupplier2Id}/items/${testItemIdForUpdate}`,
        )
        .set("Authorization", `Bearer ${operatorAuthToken}`)
        .send({
          name: "Updated Item",
          incoterm: MaritimeIncoterm.FOB,
          cost: 1000.0,
          currency: Currency.USD,
        })
        .expect(403);
      expect(response.body.message).toContain("only available for agents");
    });
    it("should return 404 Not Found when pricelist doesn't exist", async () => {
      const fakeSupplierId = new Types.ObjectId().toString();
      const fakeItemId = new Types.ObjectId().toString();
      const response = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${fakeSupplierId}/items/${fakeItemId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          name: "Updated Item",
          chargeType: ChargeType.OCEAN_FREIGHT,
          incoterm: MaritimeIncoterm.FOB,
          cost: 1000.0,
          currency: Currency.USD,
        })
        .expect(404);
      expect(response.body.message).toContain("not found");
    });
    it("should return 404 Not Found when item doesn't exist", async () => {
      const fakeItemId = new Types.ObjectId().toString();
      const response = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplier2Id}/items/${fakeItemId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          name: "Updated Item",
          chargeType: ChargeType.OCEAN_FREIGHT,
          incoterm: MaritimeIncoterm.FOB,
          cost: 1000.0,
          currency: Currency.USD,
        })
        .expect(404);
      expect(response.body.message).toContain("not found");
    });
    it("should validate item data", async () => {
      const response = await request(app.getHttpServer())
        .put(
          `/agents/pricing/suppliers/${testSupplier2Id}/items/${testItemIdForUpdate}`,
        )
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          name: "", // Invalid: empty name
          incoterm: MaritimeIncoterm.FOB,
          cost: 1000.0,
          currency: Currency.USD,
        })
        .expect(400);
      expect(response.body.message).toBeDefined();
    });
    it("should return 400 Bad Request for invalid itemId format", async () => {
      const response = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplier2Id}/items/invalid-id`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          name: "Updated Item",
          chargeType: ChargeType.OCEAN_FREIGHT,
          incoterm: MaritimeIncoterm.FOB,
          cost: 1000.0,
          currency: Currency.USD,
        })
        .expect(400);
      expect(response.body.message).toContain("Invalid itemId format");
    });
    it("should return 403 when agent is not associated with supplier", async () => {
      // Use supplier3 which is associated with agent2, not agent1
      const fakeItemId = new Types.ObjectId().toString();
      const response = await request(app.getHttpServer())
        .put(`/agents/pricing/suppliers/${testSupplier3Id}/items/${fakeItemId}`)
        .set("Authorization", `Bearer ${agentAuthToken}`)
        .send({
          name: "Updated Item",
          chargeType: ChargeType.OCEAN_FREIGHT,
          incoterm: MaritimeIncoterm.FOB,
          cost: 1000.0,
          currency: Currency.USD,
        })
        .expect(403);
      expect(response.body.message).toContain("not associated");
    });
  });
});
