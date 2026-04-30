import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { AgentPricingService } from "../src/pricing/agent-pricing.service";
import { Agent, AgentDocument } from "../src/schemas/agent.schema";
import { Shipping, ShippingDocument } from "../src/schemas/shipping.schema";
import {
  AgentPricelist,
  AgentPricelistDocument,
} from "../src/schemas/agent-pricelist.schema";
import { HistoryService } from "../src/history/history.service";
import { UpsertPricelistDto } from "../src/agents/dto/upsert-pricelist.dto";
import { MaritimeIncoterm, Currency } from "../src/common/enums/maritime-incoterms.enum";

describe("AgentPricingService", () => {
  let service: AgentPricingService;
  let pricelistModel: Model<AgentPricelistDocument>;
  let agentModel: Model<AgentDocument>;
  let shippingModel: Model<ShippingDocument>;
  let historyService: HistoryService;

  // Mock data
  const mockAgentId = new Types.ObjectId();
  const mockSupplierId = new Types.ObjectId();
  const mockItemId = new Types.ObjectId();
  const mockUserId = "user123";
  const mockUserEmail = "user@example.com";

  const mockAgent = {
    _id: mockAgentId,
    firstName: "John",
    lastName: "Doe",
    email: "agent@example.com",
    phone: "+1234567890",
    isActive: true,
    shippingLineId: null,
    agents: [],
    save: jest.fn(),
    toObject: jest.fn(),
  } as unknown as AgentDocument;

  const mockSupplier = {
    _id: mockSupplierId,
    name: "Test Shipping Company",
    email: "shipping@example.com",
    phone: "+1234567890",
    isActive: true,
    agents: [mockAgentId],
    shippingModes: ["maritime"],
    save: jest.fn(),
    toObject: jest.fn(),
  } as unknown as ShippingDocument;

  const mockPricelistItem = {
    _id: mockItemId,
    name: "40FT Container Transport",
    incoterm: MaritimeIncoterm.FOB,
    cost: 1250.0,
    currency: Currency.USD,
    metadata: { notes: "Test item" },
  };

  const mockPricelist = {
    _id: new Types.ObjectId(),
    agentId: mockAgentId,
    supplierId: mockSupplierId,
    items: [mockPricelistItem],
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn(),
    toObject: jest.fn(),
  } as unknown as AgentPricelistDocument;

  // Mock model methods
  const mockPricelistModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  };

  const mockAgentModel = {
    findById: jest.fn(),
  };

  const mockShippingModel = {
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  const mockHistoryService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentPricingService,
        {
          provide: getModelToken(AgentPricelist.name),
          useValue: mockPricelistModel,
        },
        {
          provide: getModelToken(Agent.name),
          useValue: mockAgentModel,
        },
        {
          provide: getModelToken(Shipping.name),
          useValue: mockShippingModel,
        },
        {
          provide: HistoryService,
          useValue: mockHistoryService,
        },
      ],
    }).compile();

    service = module.get<AgentPricingService>(AgentPricingService);
    pricelistModel = module.get<Model<AgentPricelistDocument>>(
      getModelToken(AgentPricelist.name),
    );
    agentModel = module.get<Model<AgentDocument>>(getModelToken(Agent.name));
    shippingModel = module.get<Model<ShippingDocument>>(
      getModelToken(Shipping.name),
    );
    historyService = module.get<HistoryService>(HistoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("listAgentSuppliers", () => {
    it("should return paginated list of suppliers for an agent", async () => {
      const query = { page: 1, limit: 20 };
      const mockSuppliers = [
        { _id: mockSupplierId, name: "Test Shipping", isActive: true },
      ];
      const mockPricelists = [
        { supplierId: mockSupplierId },
      ];

      mockAgentModel.findById.mockResolvedValue(mockAgent);
      mockShippingModel.countDocuments.mockResolvedValue(1);
      mockShippingModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockSuppliers),
              }),
            }),
          }),
        }),
      });
      mockPricelistModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockPricelists),
        }),
      });

      const result = await service.listAgentSuppliers(
        mockAgentId.toString(),
        query,
      );

      expect(result).toEqual({
        data: [
          {
            supplierId: mockSupplierId.toString(),
            name: "Test Shipping",
            isApproved: true,
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
      });
      expect(mockAgentModel.findById).toHaveBeenCalledWith(mockAgentId);
    });

    it("should throw BadRequestException for invalid agentId format", async () => {
      await expect(
        service.listAgentSuppliers("invalid-id", {}),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException when agent does not exist", async () => {
      mockAgentModel.findById.mockResolvedValue(null);

      await expect(
        service.listAgentSuppliers(mockAgentId.toString(), {}),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when agent is not active", async () => {
      const inactiveAgent = { ...mockAgent, isActive: false };
      mockAgentModel.findById.mockResolvedValue(inactiveAgent);

      await expect(
        service.listAgentSuppliers(mockAgentId.toString(), {}),
      ).rejects.toThrow(BadRequestException);
    });

    it("should filter suppliers by search term", async () => {
      const query = { search: "Test", page: 1, limit: 20 };
      const mockSuppliers = [
        { _id: mockSupplierId, name: "Test Shipping", isActive: true },
      ];

      mockAgentModel.findById.mockResolvedValue(mockAgent);
      mockShippingModel.countDocuments.mockResolvedValue(1);
      mockShippingModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockSuppliers),
              }),
            }),
          }),
        }),
      });
      mockPricelistModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      await service.listAgentSuppliers(mockAgentId.toString(), query);

      expect(mockShippingModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          name: { $regex: "Test", $options: "i" },
        }),
      );
    });

    it("should handle agents associated via shippingLineId", async () => {
      const agentWithShippingLine = {
        ...mockAgent,
        shippingLineId: mockSupplierId,
      };
      const query = { page: 1, limit: 20 };
      const mockSuppliers = [
        { _id: mockSupplierId, name: "Test Shipping", isActive: true },
      ];

      mockAgentModel.findById.mockResolvedValue(agentWithShippingLine);
      mockShippingModel.countDocuments.mockResolvedValue(1);
      mockShippingModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockSuppliers),
              }),
            }),
          }),
        }),
      });
      mockPricelistModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      await service.listAgentSuppliers(mockAgentId.toString(), query);

      expect(mockShippingModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { _id: mockSupplierId },
            { agents: mockAgentId },
          ]),
        }),
      );
    });
  });

  describe("getPricelist", () => {
    it("should return pricelist with items", async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);
      mockShippingModel.findById.mockResolvedValue(mockSupplier);
      mockPricelistModel.findOne.mockResolvedValue(mockPricelist);

      const result = await service.getPricelist(
        mockAgentId.toString(),
        mockSupplierId.toString(),
      );

      expect(result).toEqual({
        supplierId: mockSupplierId.toString(),
        items: [
          {
            id: mockItemId.toString(),
            name: "40FT Container Transport",
            incoterm: MaritimeIncoterm.FOB,
            cost: 1250.0,
            currency: Currency.USD,
            metadata: { notes: "Test item" },
          },
        ],
      });
      expect(mockPricelistModel.findOne).toHaveBeenCalledWith({
        agentId: mockAgentId,
        supplierId: mockSupplierId,
      });
    });

    it("should return empty items array when pricelist does not exist", async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);
      mockShippingModel.findById.mockResolvedValue(mockSupplier);
      mockPricelistModel.findOne.mockResolvedValue(null);

      const result = await service.getPricelist(
        mockAgentId.toString(),
        mockSupplierId.toString(),
      );

      expect(result).toEqual({
        supplierId: mockSupplierId.toString(),
        items: [],
      });
    });

    it("should throw BadRequestException for invalid agentId format", async () => {
      await expect(
        service.getPricelist("invalid-id", mockSupplierId.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for invalid supplierId format", async () => {
      await expect(
        service.getPricelist(mockAgentId.toString(), "invalid-id"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException when agent does not exist", async () => {
      mockAgentModel.findById.mockResolvedValue(null);

      await expect(
        service.getPricelist(
          mockAgentId.toString(),
          mockSupplierId.toString(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when supplier does not exist", async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);
      mockShippingModel.findById.mockResolvedValue(null);

      await expect(
        service.getPricelist(
          mockAgentId.toString(),
          mockSupplierId.toString(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when agent is not associated with supplier", async () => {
      const unassociatedSupplier = {
        ...mockSupplier,
        agents: [],
      };
      const unassociatedAgent = {
        ...mockAgent,
        shippingLineId: null,
      };

      mockAgentModel.findById.mockResolvedValue(unassociatedAgent);
      mockShippingModel.findById.mockResolvedValue(unassociatedSupplier);

      await expect(
        service.getPricelist(
          mockAgentId.toString(),
          mockSupplierId.toString(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should allow access when agent has shippingLineId matching supplier", async () => {
      const agentWithShippingLine = {
        ...mockAgent,
        shippingLineId: mockSupplierId,
      };
      const supplierWithoutAgent = {
        ...mockSupplier,
        agents: [],
      };

      mockAgentModel.findById.mockResolvedValue(agentWithShippingLine);
      mockShippingModel.findById.mockResolvedValue(supplierWithoutAgent);
      mockPricelistModel.findOne.mockResolvedValue(null);

      const result = await service.getPricelist(
        mockAgentId.toString(),
        mockSupplierId.toString(),
      );

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
    });
  });

  describe("upsertPricelist", () => {
    const mockDto: UpsertPricelistDto = {
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

    it("should create a new pricelist", async () => {
      const newPricelist = {
        ...mockPricelist,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAgentModel.findById.mockResolvedValue(mockAgent);
      mockShippingModel.findById.mockResolvedValue(mockSupplier);
      mockPricelistModel.findOneAndUpdate.mockResolvedValue(newPricelist);
      mockHistoryService.log.mockResolvedValue({});

      const result = await service.upsertPricelist(
        mockAgentId.toString(),
        mockSupplierId.toString(),
        mockDto,
        mockUserId,
        mockUserEmail,
      );

      expect(result).toBeDefined();
      expect(result.supplierId).toBe(mockSupplierId.toString());
      expect(result.items).toHaveLength(1);
      expect(mockPricelistModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          agentId: mockAgentId,
          supplierId: mockSupplierId,
        },
        {
          $set: {
            items: expect.arrayContaining([
              expect.objectContaining({
                name: "40FT Container Transport",
                incoterm: MaritimeIncoterm.FOB,
                cost: 1250.0,
                currency: Currency.USD,
              }),
            ]),
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );
      expect(mockHistoryService.log).toHaveBeenCalled();
    });

    it("should update an existing pricelist", async () => {
      const updatedPricelist = {
        ...mockPricelist,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
      };

      mockAgentModel.findById.mockResolvedValue(mockAgent);
      mockShippingModel.findById.mockResolvedValue(mockSupplier);
      mockPricelistModel.findOneAndUpdate.mockResolvedValue(updatedPricelist);
      mockHistoryService.log.mockResolvedValue({});

      await service.upsertPricelist(
        mockAgentId.toString(),
        mockSupplierId.toString(),
        mockDto,
        mockUserId,
        mockUserEmail,
      );

      expect(mockHistoryService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "update",
          entityType: "agent_pricelist",
        }),
      );
    });

    it("should throw BadRequestException when items array is empty", async () => {
      const emptyDto: UpsertPricelistDto = { items: [] };

      mockAgentModel.findById.mockResolvedValue(mockAgent);
      mockShippingModel.findById.mockResolvedValue(mockSupplier);

      await expect(
        service.upsertPricelist(
          mockAgentId.toString(),
          mockSupplierId.toString(),
          emptyDto,
          mockUserId,
          mockUserEmail,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw ForbiddenException when agent is not associated with supplier", async () => {
      const unassociatedSupplier = {
        ...mockSupplier,
        agents: [],
      };
      const unassociatedAgent = {
        ...mockAgent,
        shippingLineId: null,
      };

      mockAgentModel.findById.mockResolvedValue(unassociatedAgent);
      mockShippingModel.findById.mockResolvedValue(unassociatedSupplier);

      await expect(
        service.upsertPricelist(
          mockAgentId.toString(),
          mockSupplierId.toString(),
          mockDto,
          mockUserId,
          mockUserEmail,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException for invalid agentId format", async () => {
      await expect(
        service.upsertPricelist(
          "invalid-id",
          mockSupplierId.toString(),
          mockDto,
          mockUserId,
          mockUserEmail,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for invalid supplierId format", async () => {
      await expect(
        service.upsertPricelist(
          mockAgentId.toString(),
          "invalid-id",
          mockDto,
          mockUserId,
          mockUserEmail,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("deleteItem", () => {
    it("should delete an item from pricelist", async () => {
      const updatedPricelist = {
        ...mockPricelist,
        items: [],
      };

      mockAgentModel.findById.mockResolvedValue(mockAgent);
      mockShippingModel.findById.mockResolvedValue(mockSupplier);
      mockPricelistModel.findOne.mockResolvedValue(mockPricelist);
      mockPricelistModel.findByIdAndUpdate.mockResolvedValue(updatedPricelist);
      mockHistoryService.log.mockResolvedValue({});

      const result = await service.deleteItem(
        mockAgentId.toString(),
        mockSupplierId.toString(),
        mockItemId.toString(),
        mockUserId,
        mockUserEmail,
      );

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(0);
      expect(mockPricelistModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockPricelist._id,
        {
          $pull: { items: { _id: mockItemId } },
        },
        { new: true },
      );
      expect(mockHistoryService.log).toHaveBeenCalled();
    });

    it("should throw NotFoundException when pricelist does not exist", async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);
      mockShippingModel.findById.mockResolvedValue(mockSupplier);
      mockPricelistModel.findOne.mockResolvedValue(null);

      await expect(
        service.deleteItem(
          mockAgentId.toString(),
          mockSupplierId.toString(),
          mockItemId.toString(),
          mockUserId,
          mockUserEmail,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when item does not exist", async () => {
      const pricelistWithoutItem = {
        ...mockPricelist,
        items: [],
      };

      mockAgentModel.findById.mockResolvedValue(mockAgent);
      mockShippingModel.findById.mockResolvedValue(mockSupplier);
      mockPricelistModel.findOne.mockResolvedValue(pricelistWithoutItem);

      await expect(
        service.deleteItem(
          mockAgentId.toString(),
          mockSupplierId.toString(),
          mockItemId.toString(),
          mockUserId,
          mockUserEmail,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException for invalid itemId format", async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);
      mockShippingModel.findById.mockResolvedValue(mockSupplier);
      mockPricelistModel.findOne.mockResolvedValue(mockPricelist);

      await expect(
        service.deleteItem(
          mockAgentId.toString(),
          mockSupplierId.toString(),
          "invalid-id",
          mockUserId,
          mockUserEmail,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw ForbiddenException when agent is not associated with supplier", async () => {
      const unassociatedSupplier = {
        ...mockSupplier,
        agents: [],
      };
      const unassociatedAgent = {
        ...mockAgent,
        shippingLineId: null,
      };

      mockAgentModel.findById.mockResolvedValue(unassociatedAgent);
      mockShippingModel.findById.mockResolvedValue(unassociatedSupplier);

      await expect(
        service.deleteItem(
          mockAgentId.toString(),
          mockSupplierId.toString(),
          mockItemId.toString(),
          mockUserId,
          mockUserEmail,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException when pricelist is not found after update", async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);
      mockShippingModel.findById.mockResolvedValue(mockSupplier);
      mockPricelistModel.findOne.mockResolvedValue(mockPricelist);
      mockPricelistModel.findByIdAndUpdate.mockResolvedValue(null);

      await expect(
        service.deleteItem(
          mockAgentId.toString(),
          mockSupplierId.toString(),
          mockItemId.toString(),
          mockUserId,
          mockUserEmail,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
