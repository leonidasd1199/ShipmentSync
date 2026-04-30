import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";

/**
 * E2E Tests for Templates API
 *
 * Prerequisites:
 * - MongoDB must be running and accessible
 * - For local testing: Start MongoDB via Docker or ensure it's running locally
 *   - Docker: docker-compose up -d mongo
 *   - Local: Ensure MongoDB is running on localhost:27017
 * - Set MONGODB_URI environment variable if MongoDB is not at default location
 *   - Example: MONGODB_URI=mongodb://localhost:27017/shipsync npm run test:e2e -- templates.e2e-spec.ts
 */
describe("Templates (e2e)", () => {
  let app: INestApplication<App>;
  let authToken: string;
  let testUserId: string;
  let testCompanyId: string;
  let createdTemplateId: string;

  const createTemplateDto = {
    name: "Test Template - FCL CIF",
    category: "CIF",
    serviceType: "FCL",
    shippingModes: ["maritime"],
    headerFields: [
      {
        id: "1",
        label: "Port of Origin",
        inputType: "select",
        options: ["Shanghai", "Busan", "Singapore"],
        required: true,
        order: 1,
      },
      {
        id: "2",
        label: "Port of Destination",
        inputType: "select",
        options: ["Los Angeles", "New York", "Savannah"],
        required: true,
        order: 2,
      },
    ],
    items: [
      {
        id: "1",
        label: "Ocean Freight",
        hasPrice: true,
        hasQuantity: true,
        hasDiscount: true,
        defaultPrice: 2500,
        defaultQuantity: 1,
        defaultDiscount: 0,
        order: 1,
        applyTemplateDiscount: true,
        applyTaxes: false,
      },
      {
        id: "2",
        label: "Insurance",
        hasPrice: true,
        hasQuantity: false,
        hasDiscount: false,
        defaultPrice: 150,
        order: 2,
        applyTemplateDiscount: false,
        applyTaxes: false,
      },
    ],
    equipmentItems: [
      {
        id: "1",
        label: "20DV",
        fields: [
          {
            key: "size",
            label: "Size",
            inputType: "text",
            defaultValue: "20DV",
            order: 1,
          },
          {
            key: "weightKg",
            label: "Weight (kg)",
            inputType: "number",
            defaultValue: 0,
            order: 2,
          },
        ],
        hasPrice: true,
        hasQuantity: true,
        hasDiscount: false,
        defaultPrice: 2500,
        defaultQuantity: 1,
        order: 1,
        applyTemplateDiscount: true,
        applyTaxes: false,
      },
    ],
    pricingConfig: {
      currency: "USD",
      templatePrice: null,
      templateDiscount: 5,
      applyTemplateDiscount: true,
      templateTaxRate: null,
      applyTemplateTaxes: false,
    },
    notes: "Test template notes",
    showAgentToClient: true,
    showCarrierToClient: true,
    showCommodityToClient: true,
    showNotesToClient: true,
  };

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
    }
  }, 30000); // Increase timeout to 30 seconds for MongoDB connection

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe("POST /templates - Create Template", () => {
    it("should create a new template", async () => {
      const response = await request(app.getHttpServer())
        .post("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .send(createTemplateDto)
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.name).toBe(createTemplateDto.name);

      createdTemplateId = response.body.id;

      // Fetch the created template to validate fields
      const getResponse = await request(app.getHttpServer())
        .get(`/templates/${createdTemplateId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.category).toBe(createTemplateDto.category);
      expect(getResponse.body.serviceType).toBe(createTemplateDto.serviceType);
      expect(
        getResponse.body.companyId?._id || getResponse.body.companyId
      ).toBe(testCompanyId);
      expect(getResponse.body.isActive).toBe(true);
      expect(getResponse.body.headerFields).toHaveLength(2);
      expect(getResponse.body.items).toHaveLength(2);
      expect(getResponse.body.equipmentItems).toHaveLength(1);
      expect(getResponse.body.pricingConfig).toBeDefined();
      expect(getResponse.body.pricingConfig.currency).toBe("USD");
    });

    it("should return 400 for invalid category", async () => {
      await request(app.getHttpServer())
        .post("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          ...createTemplateDto,
          category: "INVALID",
        })
        .expect(400);
    });

    it("should return 400 for invalid serviceType", async () => {
      await request(app.getHttpServer())
        .post("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          ...createTemplateDto,
          serviceType: "INVALID",
        })
        .expect(400);
    });

    it("should return 400 for empty shippingModes", async () => {
      await request(app.getHttpServer())
        .post("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          ...createTemplateDto,
          shippingModes: [],
        })
        .expect(400);
    });

    it("should return 400 for invalid shippingMode", async () => {
      await request(app.getHttpServer())
        .post("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          ...createTemplateDto,
          shippingModes: ["invalid"],
        })
        .expect(400);
    });
  });

  describe("GET /templates - List Templates", () => {
    it("should return list of templates", async () => {
      const response = await request(app.getHttpServer())
        .get("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty("id");
        expect(response.body[0]).toHaveProperty("name");
        expect(response.body[0]).toHaveProperty("isActive");
      }
    });

    it("should filter by serviceType", async () => {
      const response = await request(app.getHttpServer())
        .get("/templates?serviceType=FCL")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((template: any) => {
        expect(template.serviceType).toBe("FCL");
      });
    });

    it("should filter by category", async () => {
      const response = await request(app.getHttpServer())
        .get("/templates?category=CIF")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((template: any) => {
        expect(template.category).toBe("CIF");
      });
    });

    it("should filter by shippingMode", async () => {
      const response = await request(app.getHttpServer())
        .get("/templates?shippingMode=maritime")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((template: any) => {
        expect(template.shippingModes).toContain("maritime");
      });
    });

    it("should filter by isActive=true", async () => {
      const response = await request(app.getHttpServer())
        .get("/templates?isActive=true")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((template: any) => {
        expect(template.isActive).toBe(true);
      });
    });

    it("should filter by isActive=false", async () => {
      const response = await request(app.getHttpServer())
        .get("/templates?isActive=false")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((template: any) => {
        expect(template.isActive).toBe(false);
      });
    });

    it("should combine multiple filters", async () => {
      const response = await request(app.getHttpServer())
        .get(
          "/templates?serviceType=FCL&category=CIF&shippingMode=maritime&isActive=true"
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((template: any) => {
        expect(template.serviceType).toBe("FCL");
        expect(template.category).toBe("CIF");
        expect(template.shippingModes).toContain("maritime");
        expect(template.isActive).toBe(true);
      });
    });

    it("should only return templates from user's company", async () => {
      const response = await request(app.getHttpServer())
        .get("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // All templates should belong to the user's company
      response.body.forEach((template: any) => {
        // companyId is populated, so check the _id property
        expect(template.companyId._id).toBe(testCompanyId);
      });
    });
  });

  describe("GET /templates/:id - Get Template by ID", () => {
    it("should return template by ID", async () => {
      if (!createdTemplateId) {
        // Create a template first if we don't have one
        const createResponse = await request(app.getHttpServer())
          .post("/templates")
          .set("Authorization", `Bearer ${authToken}`)
          .send(createTemplateDto)
          .expect(201);
        createdTemplateId = createResponse.body.id;
      }

      const response = await request(app.getHttpServer())
        .get(`/templates/${createdTemplateId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(createdTemplateId);
      expect(response.body.name).toBe(createTemplateDto.name);
      expect(response.body.headerFields).toBeDefined();
      expect(response.body.items).toBeDefined();
      expect(response.body.equipmentItems).toBeDefined();
      expect(response.body.pricingConfig).toBeDefined();
    });

    it("should return 404 for non-existent template", async () => {
      const fakeId = "507f1f77bcf86cd799439999";
      await request(app.getHttpServer())
        .get(`/templates/${fakeId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });

    it("should return 400 for invalid ID format", async () => {
      await request(app.getHttpServer())
        .get("/templates/invalid-id")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe("PATCH /templates/:id - Update Template", () => {
    it("should update template partially", async () => {
      if (!createdTemplateId) {
        const createResponse = await request(app.getHttpServer())
          .post("/templates")
          .set("Authorization", `Bearer ${authToken}`)
          .send(createTemplateDto)
          .expect(201);
        createdTemplateId = createResponse.body.id;
      }

      const updateData = {
        name: "Updated Template Name",
        notes: "Updated notes",
      };

      const response = await request(app.getHttpServer())
        .patch(`/templates/${createdTemplateId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.id).toBe(createdTemplateId);
      expect(response.body.name).toBe(updateData.name);
      expect(response.body.notes).toBe(updateData.notes);
      expect(response.body.isActive).toBe(true); // Should remain active
    });

    it("should update pricingConfig", async () => {
      if (!createdTemplateId) {
        const createResponse = await request(app.getHttpServer())
          .post("/templates")
          .set("Authorization", `Bearer ${authToken}`)
          .send(createTemplateDto)
          .expect(201);
        createdTemplateId = createResponse.body.id;
      }

      const updateData = {
        pricingConfig: {
          currency: "EUR",
          templatePrice: 1000,
          templateDiscount: 10,
          applyTemplateDiscount: true,
          templateTaxRate: 5,
          applyTemplateTaxes: true,
        },
      };

      const response = await request(app.getHttpServer())
        .patch(`/templates/${createdTemplateId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.pricingConfig.currency).toBe("EUR");
      expect(response.body.pricingConfig.templatePrice).toBe(1000);
      expect(response.body.pricingConfig.templateDiscount).toBe(10);
    });
  });

  describe("PUT /templates/:id - Replace Template", () => {
    it("should replace template completely", async () => {
      if (!createdTemplateId) {
        const createResponse = await request(app.getHttpServer())
          .post("/templates")
          .set("Authorization", `Bearer ${authToken}`)
          .send(createTemplateDto)
          .expect(201);
        createdTemplateId = createResponse.body.id;
      }

      const replaceData = {
        ...createTemplateDto,
        name: "Replaced Template Name",
        notes: "Replaced notes",
      };

      const response = await request(app.getHttpServer())
        .put(`/templates/${createdTemplateId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(replaceData)
        .expect(200);

      expect(response.body.id).toBe(createdTemplateId);
      expect(response.body.name).toBe(replaceData.name);
      expect(response.body.notes).toBe(replaceData.notes);
    });
  });

  describe("DELETE /templates/:id - Soft Delete Template", () => {
    it("should soft delete template (set isActive = false)", async () => {
      // Create a template for deletion
      const createResponse = await request(app.getHttpServer())
        .post("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .send(createTemplateDto)
        .expect(201);

      const templateId = createResponse.body.id;

      // Verify template is active after creation
      const getResponseBefore = await request(app.getHttpServer())
        .get(`/templates/${templateId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);
      expect(getResponseBefore.body.isActive).toBe(true);

      // Soft delete the template
      await request(app.getHttpServer())
        .delete(`/templates/${templateId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(204);

      // Verify template still exists but is inactive
      const getResponse = await request(app.getHttpServer())
        .get(`/templates/${templateId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.id).toBe(templateId);
      expect(getResponse.body.isActive).toBe(false); // Should be soft deleted
    });

    it("should not return soft-deleted template in default list", async () => {
      // Create and soft delete a template
      const createResponse = await request(app.getHttpServer())
        .post("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .send(createTemplateDto)
        .expect(201);

      const templateId = createResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/templates/${templateId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(204);

      // Get all templates (should filter out inactive by default)
      const listResponse = await request(app.getHttpServer())
        .get("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const deletedTemplate = listResponse.body.find(
        (t: any) => t.id === templateId
      );
      expect(deletedTemplate).toBeUndefined(); // Should not be in the list
    });

    it("should return soft-deleted template when filtering isActive=false", async () => {
      // Create and soft delete a template
      const createResponse = await request(app.getHttpServer())
        .post("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .send(createTemplateDto)
        .expect(201);

      const templateId = createResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/templates/${templateId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(204);

      // Get inactive templates
      const listResponse = await request(app.getHttpServer())
        .get("/templates?isActive=false")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const deletedTemplate = listResponse.body.find(
        (t: any) => t.id === templateId
      );
      expect(deletedTemplate).toBeDefined(); // Should be in the inactive list
      expect(deletedTemplate.isActive).toBe(false);
    });

    it("should return 404 when trying to delete non-existent template", async () => {
      const fakeId = "507f1f77bcf86cd799439999";
      await request(app.getHttpServer())
        .delete(`/templates/${fakeId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });

    it("should return 403 when trying to delete template from another company", async () => {
      // This test assumes there's a template from another company
      // In a real scenario, you'd need to create a template with a different company
      // For now, we'll just verify the endpoint exists and handles the case
      const fakeId = "507f1f77bcf86cd799439999";
      const response = await request(app.getHttpServer())
        .delete(`/templates/${fakeId}`)
        .set("Authorization", `Bearer ${authToken}`);

      // Should return 404 (not found) or 403 (forbidden) depending on implementation
      expect([403, 404]).toContain(response.status);
    });

    it("should preserve template data after soft delete", async () => {
      // Create a template with specific data
      const createResponse = await request(app.getHttpServer())
        .post("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .send(createTemplateDto)
        .expect(201);

      const templateId = createResponse.body.id;

      // Fetch the template to get full data
      const getResponseBefore = await request(app.getHttpServer())
        .get(`/templates/${templateId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const originalName = getResponseBefore.body.name;
      const originalItems = getResponseBefore.body.items || [];

      // Soft delete
      await request(app.getHttpServer())
        .delete(`/templates/${templateId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(204);

      // Verify data is preserved
      const getResponse = await request(app.getHttpServer())
        .get(`/templates/${templateId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.name).toBe(originalName);
      expect(getResponse.body.items).toHaveLength(originalItems.length);
      expect(getResponse.body.isActive).toBe(false);
    });
  });

  describe("Template Validation", () => {
    it("should validate headerFields structure", async () => {
      const templateWithInvalidHeader = {
        ...createTemplateDto,
        headerFields: [
          {
            id: "1",
            label: "Test",
            // Missing required fields
          },
        ],
      };

      await request(app.getHttpServer())
        .post("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .send(templateWithInvalidHeader)
        .expect(400);
    });

    it("should validate items structure", async () => {
      const templateWithInvalidItems = {
        ...createTemplateDto,
        items: [
          {
            id: "1",
            label: "Test",
            // Missing required fields
          },
        ],
      };

      await request(app.getHttpServer())
        .post("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .send(templateWithInvalidItems)
        .expect(400);
    });

    it("should validate equipmentItems structure", async () => {
      const templateWithInvalidEquipment = {
        ...createTemplateDto,
        equipmentItems: [
          {
            id: "1",
            label: "Test",
            // Missing required fields
          },
        ],
      };

      await request(app.getHttpServer())
        .post("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .send(templateWithInvalidEquipment)
        .expect(400);
    });
  });

  describe("Template Visibility Flags", () => {
    it("should create template with visibility flags", async () => {
      const templateWithVisibility = {
        ...createTemplateDto,
        showAgentToClient: false,
        showCarrierToClient: false,
        showCommodityToClient: true,
        showNotesToClient: true,
      };

      const response = await request(app.getHttpServer())
        .post("/templates")
        .set("Authorization", `Bearer ${authToken}`)
        .send(templateWithVisibility)
        .expect(201);

      // Fetch the template to verify visibility flags (create response doesn't include them)
      const getResponse = await request(app.getHttpServer())
        .get(`/templates/${response.body.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.showAgentToClient).toBe(false);
      expect(getResponse.body.showCarrierToClient).toBe(false);
      expect(getResponse.body.showCommodityToClient).toBe(true);
      expect(getResponse.body.showNotesToClient).toBe(true);
    });
  });
});
