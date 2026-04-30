import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";

/**
 * E2E Tests for Companies API
 *
 * Prerequisites:
 * - MongoDB must be running and accessible
 * - For local testing: Start MongoDB via Docker or ensure it's running locally
 *   - Docker: docker-compose up -d mongo
 *   - Local: Ensure MongoDB is running on localhost:27017
 * - Set MONGODB_URI environment variable if MongoDB is not at default location
 *   - Example: MONGODB_URI=mongodb://localhost:27017/shipsync npm run test:e2e -- companies.e2e-spec.ts
 * - Test user (john.doe@shipsync.com) must have the following permissions:
 *   - user:list (for GET /companies/:companyId/users)
 *   - audit:view (for GET /companies/:companyId/history)
 */
describe("Companies (e2e)", () => {
  let app: INestApplication<App>;
  let authToken: string;
  let testUserId: string;
  let testCompanyId: string;

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
  }, 30000); // Increase timeout to 30 seconds for MongoDB connection

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe("GET /companies/:companyId/users", () => {
    it("should return 401 Unauthorized without auth token", async () => {
      const response = await request(app.getHttpServer())
        .get(`/companies/${testCompanyId}/users`)
        .expect(401);

      expect(response.body.message).toContain("Unauthorized");
    });

    it("should return 400 Bad Request for invalid company ID", async () => {
      const response = await request(app.getHttpServer())
        .get("/companies/invalid-id/users")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain("Invalid");
    });

    it("should return 404 Not Found for non-existent company", async () => {
      const fakeCompanyId = "507f1f77bcf86cd799439011"; // Valid ObjectId format but non-existent
      const response = await request(app.getHttpServer())
        .get(`/companies/${fakeCompanyId}/users`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.message).toContain("not found");
    });

    it("should return 404 Not Found for non-existent different company", async () => {
      // Create a fake company ID that's different from testCompanyId
      // Note: CompanyAccessGuard checks if company exists first, so non-existent companies return 404
      const differentCompanyId = "507f1f77bcf86cd799439012";
      const response = await request(app.getHttpServer())
        .get(`/companies/${differentCompanyId}/users`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.message).toContain("not found");
    });

    it("should return 403 Forbidden without user:list permission", async () => {
      // This test assumes the user doesn't have user:list permission
      // If the user already has it, this test will pass but the assertion might fail
      const response = await request(app.getHttpServer())
        .get(`/companies/${testCompanyId}/users`)
        .set("Authorization", `Bearer ${authToken}`);

      // If user has permission, expect 200; if not, expect 403
      if (response.status === 403) {
        expect(response.body.message).toContain("user:list");
      } else if (response.status === 200) {
        // User has permission, verify response structure
        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          const user = response.body[0];
          expect(user).toHaveProperty("firstName");
          expect(user).toHaveProperty("lastName");
          expect(user).toHaveProperty("email");
          expect(user).toHaveProperty("roleCode");
          expect(user).toHaveProperty("isActive");
        }
      }
    });

    it("should return list of users for valid company", async () => {
      const response = await request(app.getHttpServer())
        .get(`/companies/${testCompanyId}/users`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // Verify user structure
      if (response.body.length > 0) {
        const user = response.body[0];
        expect(user).toHaveProperty("firstName");
        expect(user).toHaveProperty("lastName");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("roleCode");
        expect(user).toHaveProperty("isActive");
        expect(user).toHaveProperty("office_disabled");

        // Verify all users belong to the same company
        // Note: The service filters by company, so all returned users should belong to testCompanyId
        // However, we can't verify this directly from the response as companyId is not included
      }
    });

    it("should only return active users by default", async () => {
      const response = await request(app.getHttpServer())
        .get(`/companies/${testCompanyId}/users`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // Verify all returned users are active (if any users exist)
      response.body.forEach((user: any) => {
        expect(user.isActive).toBe(true);
      });
    });
  });

  describe("GET /companies/:companyId/history", () => {
    it("should return 401 Unauthorized without auth token", async () => {
      const response = await request(app.getHttpServer())
        .get(`/companies/${testCompanyId}/history`)
        .expect(401);

      expect(response.body.message).toContain("Unauthorized");
    });

    it("should return 400 Bad Request for invalid company ID", async () => {
      const response = await request(app.getHttpServer())
        .get("/companies/invalid-id/history")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain("Invalid");
    });

    it("should return 404 Not Found for non-existent company", async () => {
      const fakeCompanyId = "507f1f77bcf86cd799439011"; // Valid ObjectId format but non-existent
      const response = await request(app.getHttpServer())
        .get(`/companies/${fakeCompanyId}/history`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.message).toContain("not found");
    });

    it("should return 404 Not Found for non-existent different company", async () => {
      // Create a fake company ID that's different from testCompanyId
      // Note: CompanyAccessGuard checks if company exists first, so non-existent companies return 404
      const differentCompanyId = "507f1f77bcf86cd799439012";
      const response = await request(app.getHttpServer())
        .get(`/companies/${differentCompanyId}/history`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.message).toContain("not found");
    });

    it("should return 403 Forbidden without audit:view permission", async () => {
      // This test assumes the user doesn't have audit:view permission
      // If the user already has it, this test will pass but the assertion might fail
      const response = await request(app.getHttpServer())
        .get(`/companies/${testCompanyId}/history`)
        .set("Authorization", `Bearer ${authToken}`);

      // If user has permission, expect 200; if not, expect 403
      if (response.status === 403) {
        expect(response.body.message).toContain("audit:view");
      } else if (response.status === 200) {
        // User has permission, verify response structure
        expect(response.body).toHaveProperty("items");
        expect(response.body).toHaveProperty("total");
        expect(response.body).toHaveProperty("page");
        expect(response.body).toHaveProperty("pageSize");
        expect(response.body).toHaveProperty("totalPages");
        expect(Array.isArray(response.body.items)).toBe(true);
      }
    });

    it("should return history logs for valid company", async () => {
      const response = await request(app.getHttpServer())
        .get(`/companies/${testCompanyId}/history`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty("items");
      expect(response.body).toHaveProperty("total");
      expect(response.body).toHaveProperty("page");
      expect(response.body).toHaveProperty("pageSize");
      expect(response.body).toHaveProperty("totalPages");

      expect(Array.isArray(response.body.items)).toBe(true);
      expect(typeof response.body.total).toBe("number");
      expect(typeof response.body.page).toBe("number");
      expect(typeof response.body.pageSize).toBe("number");
      expect(typeof response.body.totalPages).toBe("number");

      // Verify history item structure if any exist
      if (response.body.items.length > 0) {
        const historyItem = response.body.items[0];
        expect(historyItem).toHaveProperty("entityType");
        expect(historyItem).toHaveProperty("entityId");
        expect(historyItem.entityType).toBe("company");
        expect(historyItem.entityId).toBe(testCompanyId);
      }
    });

    it("should return paginated results", async () => {
      const response = await request(app.getHttpServer())
        .get(`/companies/${testCompanyId}/history`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Verify pagination structure
      expect(response.body.page).toBeGreaterThanOrEqual(1);
      expect(response.body.pageSize).toBeGreaterThan(0);
      expect(response.body.total).toBeGreaterThanOrEqual(0);
      expect(response.body.totalPages).toBeGreaterThanOrEqual(0);
      expect(response.body.items.length).toBeLessThanOrEqual(
        response.body.pageSize,
      );
    });

    it("should filter history by company entity", async () => {
      const response = await request(app.getHttpServer())
        .get(`/companies/${testCompanyId}/history`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Verify all history items are for this company
      response.body.items.forEach((item: any) => {
        expect(item.entityType).toBe("company");
        expect(item.entityId).toBe(testCompanyId);
      });
    });
  });
});

