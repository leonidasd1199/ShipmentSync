import { Test, TestingModule } from "@nestjs/testing";
import { AgentPricingController } from "../src/pricing/agent-pricing.controller";
import { AgentPricingService } from "../src/pricing/agent-pricing.service";
import { UpsertPricelistDto } from "../src/agents/dto/upsert-pricelist.dto";
import { MaritimeIncoterm, Currency } from "../src/common/enums/maritime-incoterms.enum";

describe("AgentPricingController", () => {
  let controller: AgentPricingController;
  let service: AgentPricingService;

  const mockAgentId = "507f1f77bcf86cd799439011";
  const mockSupplierId = "507f1f77bcf86cd799439012";
  const mockItemId = "507f1f77bcf86cd799439013";
  const mockUserId = "user123";
  const mockUserEmail = "user@example.com";

  const mockServiceResponse = {
    supplierId: mockSupplierId,
    items: [
      {
        id: mockItemId,
        name: "40FT Container Transport",
        incoterm: MaritimeIncoterm.FOB,
        cost: 1250.0,
        currency: Currency.USD,
        metadata: { notes: "Test" },
      },
    ],
  };

  const mockListSuppliersResponse = {
    data: [
      {
        supplierId: mockSupplierId,
        name: "Test Shipping Company",
        isApproved: true,
      },
    ],
    page: 1,
    limit: 20,
    total: 1,
  };

  const mockUpsertDto: UpsertPricelistDto = {
    items: [
      {
        name: "40FT Container Transport",
        incoterm: MaritimeIncoterm.FOB,
        cost: 1250.0,
        currency: Currency.USD,
        metadata: { notes: "Test" },
      },
    ],
  };

  const mockAgentPricingService = {
    listAgentSuppliers: jest.fn(),
    getPricelist: jest.fn(),
    upsertPricelist: jest.fn(),
    deleteItem: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentPricingController],
      providers: [
        {
          provide: AgentPricingService,
          useValue: mockAgentPricingService,
        },
      ],
    }).compile();

    controller = module.get<AgentPricingController>(AgentPricingController);
    service = module.get<AgentPricingService>(AgentPricingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("listAgentSuppliers", () => {
    it("should return list of suppliers", async () => {
      mockAgentPricingService.listAgentSuppliers.mockResolvedValue(
        mockListSuppliersResponse,
      );

      const result = await controller.listAgentSuppliers(
        mockAgentId,
        undefined,
        undefined,
        undefined,
      );

      expect(result).toEqual(mockListSuppliersResponse);
      expect(service.listAgentSuppliers).toHaveBeenCalledWith(mockAgentId, {
        search: undefined,
        page: undefined,
        limit: undefined,
      });
    });

    it("should pass search query to service", async () => {
      mockAgentPricingService.listAgentSuppliers.mockResolvedValue(
        mockListSuppliersResponse,
      );

      await controller.listAgentSuppliers(
        mockAgentId,
        "Test",
        undefined,
        undefined,
      );

      expect(service.listAgentSuppliers).toHaveBeenCalledWith(mockAgentId, {
        search: "Test",
        page: undefined,
        limit: undefined,
      });
    });

    it("should parse and pass page query to service", async () => {
      mockAgentPricingService.listAgentSuppliers.mockResolvedValue(
        mockListSuppliersResponse,
      );

      await controller.listAgentSuppliers(mockAgentId, undefined, "2", undefined);

      expect(service.listAgentSuppliers).toHaveBeenCalledWith(mockAgentId, {
        search: undefined,
        page: 2,
        limit: undefined,
      });
    });

    it("should parse and pass limit query to service", async () => {
      mockAgentPricingService.listAgentSuppliers.mockResolvedValue(
        mockListSuppliersResponse,
      );

      await controller.listAgentSuppliers(
        mockAgentId,
        undefined,
        undefined,
        "10",
      );

      expect(service.listAgentSuppliers).toHaveBeenCalledWith(mockAgentId, {
        search: undefined,
        page: undefined,
        limit: 10,
      });
    });

    it("should handle all query parameters together", async () => {
      mockAgentPricingService.listAgentSuppliers.mockResolvedValue(
        mockListSuppliersResponse,
      );

      await controller.listAgentSuppliers(mockAgentId, "Test", "2", "10");

      expect(service.listAgentSuppliers).toHaveBeenCalledWith(mockAgentId, {
        search: "Test",
        page: 2,
        limit: 10,
      });
    });
  });

  describe("getPricelist", () => {
    it("should return pricelist for agent-supplier pair", async () => {
      mockAgentPricingService.getPricelist.mockResolvedValue(
        mockServiceResponse,
      );

      const result = await controller.getPricelist(
        mockAgentId,
        mockSupplierId,
      );

      expect(result).toEqual(mockServiceResponse);
      expect(service.getPricelist).toHaveBeenCalledWith(
        mockAgentId,
        mockSupplierId,
      );
    });

    it("should return empty items array when pricelist does not exist", async () => {
      const emptyResponse = {
        supplierId: mockSupplierId,
        items: [],
      };
      mockAgentPricingService.getPricelist.mockResolvedValue(emptyResponse);

      const result = await controller.getPricelist(
        mockAgentId,
        mockSupplierId,
      );

      expect(result).toEqual(emptyResponse);
      expect(result.items).toHaveLength(0);
    });
  });

  describe("upsertPricelist", () => {
    it("should create or update pricelist", async () => {
      mockAgentPricingService.upsertPricelist.mockResolvedValue(
        mockServiceResponse,
      );

      const result = await controller.upsertPricelist(
        mockAgentId,
        mockSupplierId,
        mockUpsertDto,
        mockUserId,
        mockUserEmail,
      );

      expect(result).toEqual(mockServiceResponse);
      expect(service.upsertPricelist).toHaveBeenCalledWith(
        mockAgentId,
        mockSupplierId,
        mockUpsertDto,
        mockUserId,
        mockUserEmail,
      );
    });

    it("should handle multiple items in pricelist", async () => {
      const multiItemDto: UpsertPricelistDto = {
        items: [
          {
            name: "40FT Container Transport",
            incoterm: MaritimeIncoterm.FOB,
            cost: 1250.0,
            currency: Currency.USD,
          },
          {
            name: "20FT Container Transport",
            incoterm: MaritimeIncoterm.CIF,
            cost: 800.0,
            currency: Currency.EUR,
          },
        ],
      };

      const multiItemResponse = {
        supplierId: mockSupplierId,
        items: [
          {
            id: mockItemId,
            name: "40FT Container Transport",
            incoterm: MaritimeIncoterm.FOB,
            cost: 1250.0,
            currency: Currency.USD,
          },
          {
            id: "507f1f77bcf86cd799439014",
            name: "20FT Container Transport",
            incoterm: MaritimeIncoterm.CIF,
            cost: 800.0,
            currency: Currency.EUR,
          },
        ],
      };

      mockAgentPricingService.upsertPricelist.mockResolvedValue(
        multiItemResponse,
      );

      const result = await controller.upsertPricelist(
        mockAgentId,
        mockSupplierId,
        multiItemDto,
        mockUserId,
        mockUserEmail,
      );

      expect(result).toEqual(multiItemResponse);
      expect(result.items).toHaveLength(2);
    });
  });

  describe("deleteItem", () => {
    it("should delete an item from pricelist", async () => {
      const updatedResponse = {
        supplierId: mockSupplierId,
        items: [],
      };

      mockAgentPricingService.deleteItem.mockResolvedValue(updatedResponse);

      const result = await controller.deleteItem(
        mockAgentId,
        mockSupplierId,
        mockItemId,
        mockUserId,
        mockUserEmail,
      );

      expect(result).toEqual(updatedResponse);
      expect(service.deleteItem).toHaveBeenCalledWith(
        mockAgentId,
        mockSupplierId,
        mockItemId,
        mockUserId,
        mockUserEmail,
      );
    });

    it("should return updated pricelist after deletion", async () => {
      const updatedResponse = {
        supplierId: mockSupplierId,
        items: [
          {
            id: "507f1f77bcf86cd799439014",
            name: "20FT Container Transport",
            incoterm: MaritimeIncoterm.CIF,
            cost: 800.0,
            currency: Currency.EUR,
          },
        ],
      };

      mockAgentPricingService.deleteItem.mockResolvedValue(updatedResponse);

      const result = await controller.deleteItem(
        mockAgentId,
        mockSupplierId,
        mockItemId,
        mockUserId,
        mockUserEmail,
      );

      expect(result).toEqual(updatedResponse);
      expect(result.items).toHaveLength(1);
    });
  });
});
