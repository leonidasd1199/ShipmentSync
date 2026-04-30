import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";

describe("Quotations Filters (e2e)", () => {
  let app: INestApplication<App>;
  let authToken: string;
  let testUserId: string;
  let testClientId: string;
  let testQuotationId: string;

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
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /quotations - Filter Tests", () => {
    it("should return quotations without filters", async () => {
      const response = await request(app.getHttpServer())
        .get("/quotations")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      expect(response.body).toHaveProperty("page");
      expect(response.body).toHaveProperty("limit");
      expect(response.body).toHaveProperty("total");
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it("should filter by clientId", async () => {
      // First, get all quotations to find a valid clientId
      const allQuotations = await request(app.getHttpServer())
        .get("/quotations")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      if (allQuotations.body.items.length > 0) {
        const clientId = allQuotations.body.items[0].client?._id;
        if (clientId) {
          const response = await request(app.getHttpServer())
            .get(`/quotations?clientId=${clientId}`)
            .set("Authorization", `Bearer ${authToken}`)
            .expect(200);

          expect(response.body).toHaveProperty("items");
          // All returned items should have the same clientId
          response.body.items.forEach((item: any) => {
            expect(item.client?._id).toBe(clientId);
          });
        }
      }
    });

    it("should filter by createdBy", async () => {
      const response = await request(app.getHttpServer())
        .get(`/quotations?createdBy=${testUserId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      // All returned items should be created by the test user
      response.body.items.forEach((item: any) => {
        expect(item.createdBy?._id).toBe(testUserId);
      });
    });

    it("should filter by chargeType (maritime)", async () => {
      const response = await request(app.getHttpServer())
        .get("/quotations?chargeType=maritime")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      // Verify that at least one item in each quotation has transitType maritime
      response.body.items.forEach((quotation: any) => {
        const hasMaritimeItem = quotation.items?.some(
          (item: any) =>
            item.type === "cargo" && item.transitType === "maritime"
        );
        expect(hasMaritimeItem).toBe(true);
      });
    });

    it("should filter by chargeType (air)", async () => {
      const response = await request(app.getHttpServer())
        .get("/quotations?chargeType=air")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      response.body.items.forEach((quotation: any) => {
        const hasAirItem = quotation.items?.some(
          (item: any) => item.type === "cargo" && item.transitType === "air"
        );
        expect(hasAirItem).toBe(true);
      });
    });

    it("should filter by chargeType (land)", async () => {
      const response = await request(app.getHttpServer())
        .get("/quotations?chargeType=land")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      response.body.items.forEach((quotation: any) => {
        const hasLandItem = quotation.items?.some(
          (item: any) => item.type === "cargo" && item.transitType === "land"
        );
        expect(hasLandItem).toBe(true);
      });
    });

    it("should filter by createdAtFrom", async () => {
      const fromDate = new Date("2024-01-01T00:00:00Z").toISOString();
      const response = await request(app.getHttpServer())
        .get(`/quotations?createdAtFrom=${encodeURIComponent(fromDate)}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      const fromDateObj = new Date(fromDate);
      response.body.items.forEach((quotation: any) => {
        const createdAt = new Date(quotation.createdAt);
        expect(createdAt.getTime()).toBeGreaterThanOrEqual(
          fromDateObj.getTime()
        );
      });
    });

    it("should filter by createdAtTo", async () => {
      const toDate = new Date().toISOString();
      const response = await request(app.getHttpServer())
        .get(`/quotations?createdAtTo=${encodeURIComponent(toDate)}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      const toDateObj = new Date(toDate);
      toDateObj.setHours(23, 59, 59, 999); // End of day
      response.body.items.forEach((quotation: any) => {
        const createdAt = new Date(quotation.createdAt);
        expect(createdAt.getTime()).toBeLessThanOrEqual(toDateObj.getTime());
      });
    });

    it("should filter by createdAtFrom and createdAtTo together", async () => {
      const fromDate = new Date("2024-01-01T00:00:00Z").toISOString();
      const toDate = new Date().toISOString();
      const response = await request(app.getHttpServer())
        .get(
          `/quotations?createdAtFrom=${encodeURIComponent(
            fromDate
          )}&createdAtTo=${encodeURIComponent(toDate)}`
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      const fromDateObj = new Date(fromDate);
      const toDateObj = new Date(toDate);
      toDateObj.setHours(23, 59, 59, 999);
      response.body.items.forEach((quotation: any) => {
        const createdAt = new Date(quotation.createdAt);
        expect(createdAt.getTime()).toBeGreaterThanOrEqual(
          fromDateObj.getTime()
        );
        expect(createdAt.getTime()).toBeLessThanOrEqual(toDateObj.getTime());
      });
    });

    it("should combine multiple filters", async () => {
      const fromDate = new Date("2024-01-01T00:00:00Z").toISOString();
      const response = await request(app.getHttpServer())
        .get(
          `/quotations?createdBy=${testUserId}&chargeType=maritime&createdAtFrom=${encodeURIComponent(
            fromDate
          )}`
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      const fromDateObj = new Date(fromDate);
      response.body.items.forEach((quotation: any) => {
        expect(quotation.createdBy?._id).toBe(testUserId);
        const hasMaritimeItem = quotation.items?.some(
          (item: any) =>
            item.type === "cargo" && item.transitType === "maritime"
        );
        expect(hasMaritimeItem).toBe(true);
        const createdAt = new Date(quotation.createdAt);
        expect(createdAt.getTime()).toBeGreaterThanOrEqual(
          fromDateObj.getTime()
        );
      });
    });

    it("should return 400 for invalid clientId format", async () => {
      await request(app.getHttpServer())
        .get("/quotations?clientId=invalid-id")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);
    });

    it("should return 400 for invalid createdBy format", async () => {
      await request(app.getHttpServer())
        .get("/quotations?createdBy=invalid-id")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);
    });

    it("should return 400 for invalid chargeType", async () => {
      await request(app.getHttpServer())
        .get("/quotations?chargeType=invalid")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);
    });

    it("should return 400 for invalid createdAtFrom date format", async () => {
      await request(app.getHttpServer())
        .get("/quotations?createdAtFrom=invalid-date")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);
    });

    it("should return 400 for invalid createdAtTo date format", async () => {
      await request(app.getHttpServer())
        .get("/quotations?createdAtTo=invalid-date")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);
    });

    it("should support pagination with filters", async () => {
      const response = await request(app.getHttpServer())
        .get("/quotations?page=1&limit=10&chargeType=maritime")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.items.length).toBeLessThanOrEqual(10);
    });

    it("should support sorting with filters", async () => {
      const response = await request(app.getHttpServer())
        .get("/quotations?chargeType=maritime&sort=createdAt&order=ASC")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      if (response.body.items.length > 1) {
        for (let i = 1; i < response.body.items.length; i++) {
          const prevDate = new Date(response.body.items[i - 1].createdAt);
          const currDate = new Date(response.body.items[i].createdAt);
          expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
        }
      }
    });
  });
});

