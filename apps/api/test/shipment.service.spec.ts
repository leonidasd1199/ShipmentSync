import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ShipmentService } from "../src/shipments/services/shipment.service";
import { Shipment } from "../src/schemas/shipment.schema";
import { Quotation } from "../src/schemas/quotation.schema";
import { User } from "../src/schemas/user.schema";
import { ShipmentLedgerLine } from "../src/schemas/shipment-ledger-line.schema";
import { ShipmentMode, ShipmentStatus } from "../src/schemas/shipment.schema";
import { IncotermRequirementService } from "../src/shipments/services/incoterm-requirement.service";
import { ShipmentDocumentService } from "../src/shipments/services/shipment-document.service";
import { DocumentEngineService } from "../src/shipments/services/document-engine.service";
import { CreateShipmentDto } from "../src/shipments/dto/create-shipment.dto";
import { UpdateShipmentDto } from "../src/shipments/dto/update-shipment.dto";

describe("ShipmentService", () => {
  let service: ShipmentService;

  const mockUserId = new Types.ObjectId().toString();
  const mockCompanyId = new Types.ObjectId().toString();
  const mockOfficeId = new Types.ObjectId().toString();
  const mockShipmentId = new Types.ObjectId().toString();
  const mockClientId = new Types.ObjectId().toString();

  const mockShipment = {
    _id: new Types.ObjectId(mockShipmentId),
    companyId: new Types.ObjectId(mockCompanyId),
    officeId: new Types.ObjectId(mockOfficeId),
    mode: ShipmentMode.OCEAN,
    incoterm: "FOB",
    status: ShipmentStatus.DRAFT,
    parties: {
      shipper: { name: "Test Shipper" },
      consignee: { name: "Test Consignee" },
    },
    cargo: { containers: [] },
    operationalUserId: new Types.ObjectId(mockUserId),
    createdBy: new Types.ObjectId(mockUserId),
    toObject: jest.fn().mockReturnThis(),
    save: jest.fn(),
  };

  const mockShipmentModel = {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const mockQuotationModel = {
    findById: jest.fn(),
  };

  const mockIncotermRequirementService = {
    findByModeAndIncoterm: jest.fn(),
  };

  const mockDocumentService = {
    getDocumentsForShipment: jest.fn(),
  };

  const mockDocumentEngineService = {
    getRequiredDocuments: jest.fn(),
    getDocumentsWithRequired: jest.fn(),
    lockDocuments: jest.fn(),
  };

  const mockUserModel = {
    findById: jest.fn(),
  };

  const mockLedgerLineModel = {
    updateMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentService,
        {
          provide: getModelToken(Shipment.name),
          useValue: mockShipmentModel,
        },
        {
          provide: getModelToken(Quotation.name),
          useValue: mockQuotationModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(ShipmentLedgerLine.name),
          useValue: mockLedgerLineModel,
        },
        {
          provide: IncotermRequirementService,
          useValue: mockIncotermRequirementService,
        },
        {
          provide: ShipmentDocumentService,
          useValue: mockDocumentService,
        },
        {
          provide: DocumentEngineService,
          useValue: mockDocumentEngineService,
        },
      ],
    }).compile();

    service = module.get<ShipmentService>(ShipmentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================
  // create()
  // =========================================================

  describe("create()", () => {
    const baseCreateDto: CreateShipmentDto = {
      companyId: mockCompanyId,
      officeId: mockOfficeId,
      mode: ShipmentMode.OCEAN,
      incoterm: "FOB",
      parties: {
        shipper: { name: "Shipper Inc." },
        consignee: { name: "Consignee Ltd." },
      },
      cargo: { containers: [{ containerNumber: "UNITTEST01" }] },
      operationalUserId: mockUserId,
    };

    beforeEach(() => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              _id: new Types.ObjectId(mockUserId),
              email: "operator@test.com",
              firstName: "Op",
              lastName: "User",
            }),
          }),
        }),
      });
    });

    it("should create a shipment in DRAFT status", async () => {
      mockShipmentModel.create.mockResolvedValue({
        ...mockShipment,
        status: ShipmentStatus.DRAFT,
      });

      const result = await service.create(baseCreateDto, mockUserId);

      expect(mockShipmentModel.create).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(ShipmentStatus.DRAFT);
    });

    it("should set createdBy to the userId", async () => {
      mockShipmentModel.create.mockResolvedValue(mockShipment);

      await service.create(baseCreateDto, mockUserId);

      const createCall = mockShipmentModel.create.mock.calls[0][0] as any;
      expect(createCall.createdBy.toString()).toBe(mockUserId);
    });

    it("should convert clientId strings to ObjectIds in parties", async () => {
      mockShipmentModel.create.mockResolvedValue(mockShipment);

      const dto: CreateShipmentDto = {
        ...baseCreateDto,
        parties: {
          shipper: { name: "Shipper", clientId: mockClientId },
          consignee: { name: "Consignee" },
        },
      };

      await service.create(dto, mockUserId);

      const createCall = mockShipmentModel.create.mock.calls[0][0] as any;
      expect(createCall.parties.shipper.clientId).toBeInstanceOf(Types.ObjectId);
      expect(createCall.parties.shipper.clientId.toString()).toBe(mockClientId);
    });

    it("should map per-container packages and derive fallback package fields", async () => {
      mockShipmentModel.create.mockResolvedValue(mockShipment);
      const dto: CreateShipmentDto = {
        ...baseCreateDto,
        cargo: {
          containers: [
            {
              containerNumber: "CONT001",
              packages: [
                {
                  type: "PALLET",
                  quantity: 2,
                  dimensions: { length: 120, width: 80, height: 100, unit: "cm" },
                },
              ],
            },
          ],
        },
      };

      await service.create(dto, mockUserId);

      const createCall = mockShipmentModel.create.mock.calls[0][0] as any;
      expect(createCall.cargo.containers[0].packages).toHaveLength(1);
      expect(createCall.cargo.packagesQuantity).toBe(2);
      expect(createCall.cargo.packagesType).toBe("PALLET");
      expect(createCall.cargo.volumeCbm).toBeGreaterThan(0);
    });

    it("should validate quotationSnapshot.quotationId exists", async () => {
      const fakeQuotationId = new Types.ObjectId().toString();
      mockQuotationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const dto: CreateShipmentDto = {
        ...baseCreateDto,
        quotationSnapshot: {
          quotationId: fakeQuotationId,
          snapshotTakenAt: new Date().toISOString(),
          snapshotTakenBy: mockUserId,
        },
      };

      await expect(service.create(dto, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(dto, mockUserId)).rejects.toThrow(
        fakeQuotationId,
      );
    });

    it("should skip quotation check when no quotationSnapshot", async () => {
      mockShipmentModel.create.mockResolvedValue(mockShipment);

      await service.create(baseCreateDto, mockUserId);

      expect(mockQuotationModel.findById).not.toHaveBeenCalled();
    });

    it("should convert transport portOfLoadingId to ObjectId", async () => {
      const portId = new Types.ObjectId().toString();
      mockShipmentModel.create.mockResolvedValue(mockShipment);

      const dto: CreateShipmentDto = {
        ...baseCreateDto,
        transport: { portOfLoadingId: portId },
      };

      await service.create(dto, mockUserId);

      const createCall = mockShipmentModel.create.mock.calls[0][0] as any;
      expect(createCall.transport.portOfLoadingId).toBeInstanceOf(Types.ObjectId);
      expect(createCall.transport.portOfLoadingId.toString()).toBe(portId);
    });

    it("should parse date strings for dates.etd and dates.eta", async () => {
      mockShipmentModel.create.mockResolvedValue(mockShipment);

      const dto: CreateShipmentDto = {
        ...baseCreateDto,
        dates: {
          etd: "2026-04-01T00:00:00.000Z",
          eta: "2026-04-15T00:00:00.000Z",
        },
      };

      await service.create(dto, mockUserId);

      const createCall = mockShipmentModel.create.mock.calls[0][0] as any;
      expect(createCall.dates.etd).toBeInstanceOf(Date);
      expect(createCall.dates.eta).toBeInstanceOf(Date);
    });

    it("should throw BadRequestException on Mongoose ValidationError", async () => {
      const validationError = {
        name: "ValidationError",
        errors: { incoterm: { message: "incoterm is required" } },
      };
      mockShipmentModel.create.mockRejectedValue(validationError);

      await expect(service.create(baseCreateDto, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException on BSONTypeError (invalid ObjectId)", async () => {
      const bsonError = { name: "BSONTypeError", message: "Invalid ObjectId" };
      mockShipmentModel.create.mockRejectedValue(bsonError);

      await expect(service.create(baseCreateDto, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // =========================================================
  // findOne()
  // =========================================================

  describe("findOne()", () => {
    it("should return the shipment when found", async () => {
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockShipment),
      });

      const result = await service.findOne(mockShipmentId);

      expect(result).toEqual(mockShipment);
      expect(mockShipmentModel.findById).toHaveBeenCalledWith(mockShipmentId);
    });

    it("should throw NotFoundException when shipment does not exist", async () => {
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne(mockShipmentId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================
  // update()
  // =========================================================

  describe("update()", () => {
    const baseUpdateDto: UpdateShipmentDto = {
      bookingNumber: "BK-2026-001",
    };

    beforeEach(() => {
      // findOne internally used by update()
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockShipment),
      });
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              _id: new Types.ObjectId(mockUserId),
              email: "operator@test.com",
              firstName: "Op",
              lastName: "User",
            }),
          }),
        }),
      });
    });

    it("should update a DRAFT shipment and return updated document", async () => {
      const updated = { ...mockShipment, bookingNumber: "BK-2026-001" };
      mockShipmentModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      const result = await service.update(mockShipmentId, baseUpdateDto, mockUserId);

      expect(mockShipmentModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(result.bookingNumber).toBe("BK-2026-001");
    });

    it("should throw ForbiddenException when shipment is not DRAFT", async () => {
      const lockedShipment = {
        ...mockShipment,
        status: ShipmentStatus.READY_FOR_FINANCE,
      };
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(lockedShipment),
      });

      await expect(
        service.update(mockShipmentId, baseUpdateDto, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should set updatedBy to userId", async () => {
      const updated = { ...mockShipment, updatedBy: new Types.ObjectId(mockUserId) };
      mockShipmentModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      await service.update(mockShipmentId, baseUpdateDto, mockUserId);

      const updateCall = mockShipmentModel.findByIdAndUpdate.mock.calls[0][1] as any;
      expect(updateCall.updatedBy.toString()).toBe(mockUserId);
    });

    it("should sync ledger supplierId when shippingLineId changes", async () => {
      const oldSupplierId = new Types.ObjectId().toString();
      const newSupplierId = new Types.ObjectId().toString();
      const shipmentWithSupplier = {
        ...mockShipment,
        shippingLineId: new Types.ObjectId(oldSupplierId),
      };
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(shipmentWithSupplier),
      });
      mockShipmentModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...shipmentWithSupplier,
          shippingLineId: new Types.ObjectId(newSupplierId),
        }),
      });
      mockLedgerLineModel.updateMany.mockResolvedValue({ modifiedCount: 2 });

      await service.update(
        mockShipmentId,
        { shippingLineId: newSupplierId },
        mockUserId,
      );

      expect(mockLedgerLineModel.updateMany).toHaveBeenCalledWith(
        { shipmentId: shipmentWithSupplier._id },
        { $set: { supplierId: expect.any(Types.ObjectId) } },
      );
    });

    it("should convert parties.shipper.clientId to ObjectId when provided", async () => {
      const updated = { ...mockShipment };
      mockShipmentModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      const dto: UpdateShipmentDto = {
        parties: {
          shipper: { name: "New Shipper", clientId: mockClientId },
          consignee: { name: "New Consignee" },
        },
      };

      await service.update(mockShipmentId, dto, mockUserId);

      const updateCall = mockShipmentModel.findByIdAndUpdate.mock.calls[0][1] as any;
      expect(updateCall.parties.shipper.clientId).toBeInstanceOf(Types.ObjectId);
      expect(updateCall.parties.shipper.clientId.toString()).toBe(mockClientId);
    });

    it("should convert transport port IDs to ObjectIds", async () => {
      const portId = new Types.ObjectId().toString();
      const updated = { ...mockShipment };
      mockShipmentModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      const dto: UpdateShipmentDto = {
        transport: { portOfLoadingId: portId, portOfDischargeId: portId },
      };

      await service.update(mockShipmentId, dto, mockUserId);

      const updateCall = mockShipmentModel.findByIdAndUpdate.mock.calls[0][1] as any;
      expect(updateCall.transport.portOfLoadingId).toBeInstanceOf(Types.ObjectId);
      expect(updateCall.transport.portOfDischargeId).toBeInstanceOf(Types.ObjectId);
    });

    it("should persist per-container packages during update", async () => {
      const updated = { ...mockShipment };
      mockShipmentModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      const dto: UpdateShipmentDto = {
        cargo: {
          containers: [
            {
              containerNumber: "CONT002",
              packages: [
                {
                  type: "BOX",
                  quantity: 3,
                  dimensions: { length: 30, width: 20, height: 10, unit: "cm" },
                },
              ],
            },
          ],
        },
      };

      await service.update(mockShipmentId, dto, mockUserId);

      const updateCall = mockShipmentModel.findByIdAndUpdate.mock.calls[0][1] as any;
      expect(updateCall.cargo.containers[0].packages[0].dimensions.length).toBe(30);
      expect(updateCall.cargo.packagesQuantity).toBe(3);
      expect(updateCall.cargo.packagesType).toBe("BOX");
    });

    it("should throw NotFoundException when shipment not found during update", async () => {
      mockShipmentModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.update(mockShipmentId, baseUpdateDto, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should validate quotationSnapshot.quotationId on update", async () => {
      const fakeQuotationId = new Types.ObjectId().toString();
      mockQuotationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const dto: UpdateShipmentDto = {
        quotationSnapshot: {
          quotationId: fakeQuotationId,
        },
      };

      await expect(
        service.update(mockShipmentId, dto, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException on CastError", async () => {
      const castError = { name: "CastError", message: "Cast to ObjectId failed" };
      mockShipmentModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockRejectedValue(castError),
      });

      await expect(
        service.update(mockShipmentId, baseUpdateDto, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should parse date strings in dates field", async () => {
      const updated = { ...mockShipment };
      mockShipmentModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      const dto: UpdateShipmentDto = {
        dates: {
          etd: "2026-05-01T00:00:00.000Z",
          eta: "2026-05-20T00:00:00.000Z",
        },
      };

      await service.update(mockShipmentId, dto, mockUserId);

      const updateCall = mockShipmentModel.findByIdAndUpdate.mock.calls[0][1] as any;
      expect(updateCall.dates.etd).toBeInstanceOf(Date);
      expect(updateCall.dates.eta).toBeInstanceOf(Date);
    });
  });

  // =========================================================
  // workflow transitions
  // =========================================================

  describe("financeReview()", () => {
    it("should throw BadRequestException if status is not READY_FOR_FINANCE", async () => {
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockShipment, status: ShipmentStatus.DRAFT }),
      });

      await expect(
        service.financeReview(mockShipmentId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should transition to FINANCE_REVIEW when status is READY_FOR_FINANCE", async () => {
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockShipment,
          status: ShipmentStatus.READY_FOR_FINANCE,
        }),
      });
      mockShipmentModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockShipment,
          status: ShipmentStatus.FINANCE_REVIEW,
        }),
      });

      const result = await service.financeReview(mockShipmentId, mockUserId);

      expect(result.status).toBe(ShipmentStatus.FINANCE_REVIEW);
    });
  });

  describe("approve()", () => {
    it("should throw BadRequestException if status is not FINANCE_REVIEW", async () => {
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockShipment, status: ShipmentStatus.DRAFT }),
      });

      await expect(service.approve(mockShipmentId, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should transition to APPROVED when status is FINANCE_REVIEW", async () => {
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockShipment,
          status: ShipmentStatus.FINANCE_REVIEW,
        }),
      });
      mockShipmentModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockShipment,
          status: ShipmentStatus.APPROVED,
        }),
      });

      const result = await service.approve(mockShipmentId, mockUserId, undefined);

      expect(result.status).toBe(ShipmentStatus.APPROVED);
    });

    it("should persist optional note on approve", async () => {
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockShipment,
          status: ShipmentStatus.FINANCE_REVIEW,
        }),
      });
      mockShipmentModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockShipment,
          status: ShipmentStatus.APPROVED,
          financeLastNote: "Looks good",
        }),
      });

      const result = await service.approve(mockShipmentId, mockUserId, {
        note: "Looks good",
      });

      expect(result.status).toBe(ShipmentStatus.APPROVED);
      const updatePayload = mockShipmentModel.findByIdAndUpdate.mock.calls[0][1] as {
        financeLastNote?: string;
      };
      expect(updatePayload.financeLastNote).toBe("Looks good");
    });
  });

  describe("rejectFinanceReview()", () => {
    it("should throw BadRequestException if status is not FINANCE_REVIEW", async () => {
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockShipment, status: ShipmentStatus.DRAFT }),
      });

      await expect(
        service.rejectFinanceReview(mockShipmentId, mockUserId, "reason"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if note is empty", async () => {
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockShipment,
          status: ShipmentStatus.FINANCE_REVIEW,
        }),
      });

      await expect(
        service.rejectFinanceReview(mockShipmentId, mockUserId, "   "),
      ).rejects.toThrow(BadRequestException);
    });

    it("should transition to DRAFT with note when status is FINANCE_REVIEW", async () => {
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockShipment,
          status: ShipmentStatus.FINANCE_REVIEW,
        }),
      });
      mockShipmentModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockShipment,
          status: ShipmentStatus.DRAFT,
          financeLastNote: "Fix amounts",
        }),
      });

      const result = await service.rejectFinanceReview(
        mockShipmentId,
        mockUserId,
        "Fix amounts",
      );

      expect(result.status).toBe(ShipmentStatus.DRAFT);
    });
  });

  describe("close()", () => {
    it("should throw BadRequestException if status is not APPROVED", async () => {
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockShipment, status: ShipmentStatus.DRAFT }),
      });

      await expect(service.close(mockShipmentId, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should transition to CLOSED when status is APPROVED", async () => {
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockShipment,
          status: ShipmentStatus.APPROVED,
        }),
      });
      mockShipmentModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockShipment,
          status: ShipmentStatus.CLOSED,
        }),
      });

      const result = await service.close(mockShipmentId, mockUserId);

      expect(result.status).toBe(ShipmentStatus.CLOSED);
    });
  });
});
