import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import {
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ShipmentLedgerService } from "../src/shipments/services/shipment-ledger.service";
import {
  ShipmentLedgerLine,
  LedgerSide,
} from "../src/schemas/shipment-ledger-line.schema";
import { ShipmentLedgerDocument } from "../src/schemas/shipment-ledger-document.schema";
import { Shipment } from "../src/schemas/shipment.schema";
import { Quotation } from "../src/schemas/quotation.schema";
import { Shipping } from "../src/schemas/shipping.schema";
import { StorageService } from "../src/shipments/services/storage.service";

describe("ShipmentLedgerService — ledger documents", () => {
  let service: ShipmentLedgerService;

  const mockUserId = new Types.ObjectId().toString();
  const mockShipmentId = new Types.ObjectId().toString();
  const mockLineId = new Types.ObjectId().toString();

  const mockShipmentModel = {
    findById: jest.fn(),
  };

  const mockLedgerLineModel = {
    findById: jest.fn(),
    find: jest.fn(),
  };

  const mockLedgerDocumentModel = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    aggregate: jest.fn(),
  };

  const mockQuotationModel = {};
  const mockShippingModel = {};

  const mockStorageService = {
    generateLedgerDocumentStorageKey: jest.fn(
      (shipmentId: string, lineId: string, fileName: string) =>
        `shipments/${shipmentId}/ledger-documents/${lineId}/${fileName}`,
    ),
    saveFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(Buffer.from("")),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentLedgerService,
        {
          provide: getModelToken(ShipmentLedgerLine.name),
          useValue: mockLedgerLineModel,
        },
        {
          provide: getModelToken(ShipmentLedgerDocument.name),
          useValue: mockLedgerDocumentModel,
        },
        {
          provide: getModelToken(Shipment.name),
          useValue: mockShipmentModel,
        },
        {
          provide: getModelToken(Quotation.name),
          useValue: mockQuotationModel,
        },
        {
          provide: getModelToken(Shipping.name),
          useValue: mockShippingModel,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    service = module.get<ShipmentLedgerService>(ShipmentLedgerService);
  });

  function debitLine() {
    return {
      _id: new Types.ObjectId(mockLineId),
      shipmentId: new Types.ObjectId(mockShipmentId),
      side: LedgerSide.DEBIT,
    };
  }

  function creditLine() {
    return {
      _id: new Types.ObjectId(mockLineId),
      shipmentId: new Types.ObjectId(mockShipmentId),
      side: LedgerSide.CREDIT,
    };
  }

  const samplePdfUpload = {
    buffer: Buffer.from("%PDF"),
    mimetype: "application/pdf",
    originalname: "inv.pdf",
    size: 4,
  } as const;

  /** Shipment exists + ledger line is DEBIT — common setup for successful uploads */
  function stubDebitLineUploadPrerequisites() {
    mockShipmentModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: mockShipmentId }),
    });
    mockLedgerLineModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(debitLine()),
    });
  }

  function stubCreditLineUploadPrerequisites() {
    mockShipmentModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: mockShipmentId }),
    });
    mockLedgerLineModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(creditLine()),
    });
  }

  /** Shape returned by `ledgerDocumentModel.create`, consumed by `toLedgerDocumentResponse` */
  function ledgerDocumentDocFromCreatePayload(
    payload: Record<string, unknown>,
  ) {
    const id = payload._id as Types.ObjectId;
    return {
      _id: id,
      shipmentId: payload.shipmentId,
      ledgerLineId: payload.ledgerLineId,
      fileName: payload.fileName,
      originalFileName: payload.originalFileName,
      mimeType: payload.mimeType,
      size: payload.size,
      storageKey: payload.storageKey,
      uploadedBy: payload.uploadedBy,
      isActive: payload.isActive,
      ...(payload.note !== undefined ? { note: payload.note } : {}),
      toObject: () => ({
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      }),
    };
  }

  it("uploadLedgerDocument rejects when shipment missing", async () => {
    mockShipmentModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.uploadLedgerDocument(
        mockShipmentId,
        mockLineId,
        {
          buffer: Buffer.from("%PDF"),
          mimetype: "application/pdf",
          originalname: "a.pdf",
          size: 4,
        },
        mockUserId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("uploadLedgerDocument rejects when ledger line missing", async () => {
    mockShipmentModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: mockShipmentId }),
    });
    mockLedgerLineModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.uploadLedgerDocument(
        mockShipmentId,
        mockLineId,
        {
          buffer: Buffer.from("%PDF"),
          mimetype: "application/pdf",
          originalname: "a.pdf",
          size: 4,
        },
        mockUserId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("uploadLedgerDocument rejects when line shipment mismatch", async () => {
    mockShipmentModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: mockShipmentId }),
    });
    mockLedgerLineModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        ...debitLine(),
        shipmentId: new Types.ObjectId(),
      }),
    });

    await expect(
      service.uploadLedgerDocument(
        mockShipmentId,
        mockLineId,
        {
          buffer: Buffer.from("%PDF"),
          mimetype: "application/pdf",
          originalname: "a.pdf",
          size: 4,
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("uploadLedgerDocument rejects when file buffer is empty", async () => {
    mockShipmentModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: mockShipmentId }),
    });
    mockLedgerLineModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(debitLine()),
    });

    await expect(
      service.uploadLedgerDocument(
        mockShipmentId,
        mockLineId,
        {
          buffer: Buffer.alloc(0),
          mimetype: "application/pdf",
          originalname: "a.pdf",
          size: 0,
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("uploadLedgerDocument saves file and creates record for CREDIT line", async () => {
    stubCreditLineUploadPrerequisites();

    mockLedgerDocumentModel.create.mockImplementation(
      (payload: Record<string, unknown>) => {
        expect((payload.ledgerLineId as Types.ObjectId).toString()).toBe(
          mockLineId,
        );
        return Promise.resolve(ledgerDocumentDocFromCreatePayload(payload));
      },
    );

    const result = await service.uploadLedgerDocument(
      mockShipmentId,
      mockLineId,
      samplePdfUpload,
      mockUserId,
    );

    expect(mockStorageService.saveFile).toHaveBeenCalled();
    expect(result.originalFileName).toBe("inv.pdf");
  });

  it("uploadLedgerDocument saves file and creates record for DEBIT line", async () => {
    stubDebitLineUploadPrerequisites();

    mockLedgerDocumentModel.create.mockImplementation(
      (payload: Record<string, unknown>) => {
        expect((payload.shipmentId as Types.ObjectId).toString()).toBe(
          mockShipmentId,
        );
        expect((payload.ledgerLineId as Types.ObjectId).toString()).toBe(
          mockLineId,
        );
        expect(payload.mimeType).toBe("application/pdf");
        expect(payload.fileName as string).toMatch(/^[a-f0-9]{24}\.pdf$/);
        return Promise.resolve(ledgerDocumentDocFromCreatePayload(payload));
      },
    );

    const result = await service.uploadLedgerDocument(
      mockShipmentId,
      mockLineId,
      samplePdfUpload,
      mockUserId,
    );

    expect(mockStorageService.saveFile).toHaveBeenCalled();
    expect(result.originalFileName).toBe("inv.pdf");
    expect(result.fileName).toMatch(/^[a-f0-9]{24}\.pdf$/);
  });

  it("uploadLedgerDocument stores optional note for DEBIT line", async () => {
    const rawNote = "  Invoice copy for Q1  ";
    const trimmedNote = "Invoice copy for Q1";

    stubDebitLineUploadPrerequisites();

    mockLedgerDocumentModel.create.mockImplementation(
      (payload: Record<string, unknown>) => {
        expect(payload.note).toBe(trimmedNote);
        return Promise.resolve(ledgerDocumentDocFromCreatePayload(payload));
      },
    );

    const result = await service.uploadLedgerDocument(
      mockShipmentId,
      mockLineId,
      samplePdfUpload,
      mockUserId,
      rawNote,
    );

    expect(result.note).toBe(trimmedNote);
  });

  it("listLedgerDocuments returns empty for CREDIT line when no documents", async () => {
    mockShipmentModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: mockShipmentId }),
    });
    mockLedgerLineModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(creditLine()),
    });

    mockLedgerDocumentModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    });

    const list = await service.listLedgerDocuments(
      mockShipmentId,
      mockLineId,
    );
    expect(list).toEqual([]);
  });

  it("listLedgerDocuments returns active docs newest first", async () => {
    mockShipmentModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: mockShipmentId }),
    });
    mockLedgerLineModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(debitLine()),
    });

    const older = new Types.ObjectId();
    const newer = new Types.ObjectId();
    const docOlder = {
      _id: older,
      shipmentId: new Types.ObjectId(mockShipmentId),
      ledgerLineId: new Types.ObjectId(mockLineId),
      fileName: "a.pdf",
      originalFileName: "a.pdf",
      mimeType: "application/pdf",
      size: 1,
      storageKey: "k1",
      uploadedBy: new Types.ObjectId(mockUserId),
      isActive: true,
      toObject: () => ({
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
      }),
    };
    const docNewer = {
      ...docOlder,
      _id: newer,
      fileName: "b.pdf",
      originalFileName: "b.pdf",
      storageKey: "k2",
      toObject: () => ({
        createdAt: new Date("2026-06-01"),
        updatedAt: new Date("2026-06-01"),
      }),
    };

    mockLedgerDocumentModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([docNewer, docOlder]),
      }),
    });

    const list = await service.listLedgerDocuments(
      mockShipmentId,
      mockLineId,
    );

    expect(list).toHaveLength(2);
    expect(list[0].originalFileName).toBe("b.pdf");
    expect(list[1].originalFileName).toBe("a.pdf");
  });

  describe("findByShipmentId document summaries", () => {
    const lineIdA = new Types.ObjectId();
    const lineIdB = new Types.ObjectId();

    beforeEach(() => {
      mockLedgerDocumentModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });
    });

    function mockLine(id: Types.ObjectId, side: LedgerSide) {
      return {
        _id: id,
        shipmentId: new Types.ObjectId(mockShipmentId),
        side,
        supplierId: undefined,
        toJSON: () => ({
          _id: id.toString(),
          shipmentId: mockShipmentId,
          side,
        }),
      };
    }

    it("attaches documentsCount and hasDocuments from active docs aggregate", async () => {
      const lineA = mockLine(lineIdA, LedgerSide.DEBIT);
      const lineB = mockLine(lineIdB, LedgerSide.CREDIT);
      mockLedgerLineModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([lineA, lineB]),
        }),
      });
      mockLedgerDocumentModel.aggregate.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([{ _id: lineIdA, count: 2 }]),
      });

      const rows = await service.findByShipmentId(mockShipmentId);
      expect(rows).toHaveLength(2);
      const debitRow = rows.find((r) => r._id === lineIdA.toString());
      const creditRow = rows.find((r) => r._id === lineIdB.toString());
      expect(debitRow?.documentsCount).toBe(2);
      expect(debitRow?.hasDocuments).toBe(true);
      expect(creditRow?.documentsCount).toBe(0);
      expect(creditRow?.hasDocuments).toBe(false);
    });

    it("does not query documents when there are no ledger lines", async () => {
      mockLedgerLineModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });
      await service.findByShipmentId(mockShipmentId);
      expect(mockLedgerDocumentModel.aggregate).not.toHaveBeenCalled();
    });
  });

  describe("downloadLedgerDocumentFile", () => {
    const docObjectId = new Types.ObjectId();

    beforeEach(() => {
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: mockShipmentId }),
      });
      mockLedgerLineModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(debitLine()),
      });
    });

    it("returns buffer and metadata for active document", async () => {
      const doc = {
        _id: docObjectId,
        shipmentId: new Types.ObjectId(mockShipmentId),
        ledgerLineId: new Types.ObjectId(mockLineId),
        storageKey: "k1",
        mimeType: "application/pdf",
        originalFileName: "invoice.pdf",
        isActive: true,
      };
      mockLedgerDocumentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      });
      mockStorageService.readFile.mockResolvedValue(Buffer.from("%PDF"));

      const result = await service.downloadLedgerDocumentFile(
        mockShipmentId,
        mockLineId,
        docObjectId.toString(),
      );

      expect(result.buffer.toString()).toBe("%PDF");
      expect(result.mimeType).toBe("application/pdf");
      expect(result.originalFileName).toBe("invoice.pdf");
      expect(mockStorageService.readFile).toHaveBeenCalledWith("k1");
    });

    it("throws NotFound when document is inactive", async () => {
      const doc = {
        _id: docObjectId,
        shipmentId: new Types.ObjectId(mockShipmentId),
        ledgerLineId: new Types.ObjectId(mockLineId),
        storageKey: "k1",
        mimeType: "application/pdf",
        originalFileName: "invoice.pdf",
        isActive: false,
      };
      mockLedgerDocumentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      });

      await expect(
        service.downloadLedgerDocumentFile(
          mockShipmentId,
          mockLineId,
          docObjectId.toString(),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockStorageService.readFile).not.toHaveBeenCalled();
    });
  });

  describe("deleteLedgerDocument", () => {
    const docObjectId = new Types.ObjectId();

    beforeEach(() => {
      mockShipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: mockShipmentId }),
      });
      mockLedgerLineModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(debitLine()),
      });
    });

    it("throws NotFound when document is missing", async () => {
      mockLedgerDocumentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.deleteLedgerDocument(
          mockShipmentId,
          mockLineId,
          docObjectId.toString(),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
    });

    it("throws BadRequest when document belongs to another ledger line", async () => {
      const doc = {
        _id: docObjectId,
        shipmentId: new Types.ObjectId(mockShipmentId),
        ledgerLineId: new Types.ObjectId(),
        storageKey: "k",
        isActive: true,
        save: jest.fn(),
      };
      mockLedgerDocumentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      });
      await expect(
        service.deleteLedgerDocument(
          mockShipmentId,
          mockLineId,
          docObjectId.toString(),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(doc.save).not.toHaveBeenCalled();
    });

    it("throws BadRequest when document shipmentId does not match route", async () => {
      const doc = {
        _id: docObjectId,
        shipmentId: new Types.ObjectId(),
        ledgerLineId: new Types.ObjectId(mockLineId),
        storageKey: "k",
        isActive: true,
        save: jest.fn(),
      };
      mockLedgerDocumentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      });
      await expect(
        service.deleteLedgerDocument(
          mockShipmentId,
          mockLineId,
          docObjectId.toString(),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(doc.save).not.toHaveBeenCalled();
    });

    it("proceeds for CREDIT ledger line when document is valid", async () => {
      mockLedgerLineModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(creditLine()),
      });
      const doc = {
        _id: docObjectId,
        shipmentId: new Types.ObjectId(mockShipmentId),
        ledgerLineId: new Types.ObjectId(mockLineId),
        storageKey: "shipments/a/ledger-documents/b/c.pdf",
        isActive: true,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockLedgerDocumentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      });

      const result = await service.deleteLedgerDocument(
        mockShipmentId,
        mockLineId,
        docObjectId.toString(),
      );

      expect(result).toEqual({
        documentId: docObjectId.toString(),
        isActive: false,
      });
      expect(mockLedgerDocumentModel.findById).toHaveBeenCalled();
    });

    it("sets isActive false, saves, and deletes file", async () => {
      const doc = {
        _id: docObjectId,
        shipmentId: new Types.ObjectId(mockShipmentId),
        ledgerLineId: new Types.ObjectId(mockLineId),
        storageKey: "shipments/a/ledger-documents/b/c.pdf",
        isActive: true,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockLedgerDocumentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      });

      const result = await service.deleteLedgerDocument(
        mockShipmentId,
        mockLineId,
        docObjectId.toString(),
      );

      expect(result).toEqual({
        documentId: docObjectId.toString(),
        isActive: false,
      });
      expect(doc.isActive).toBe(false);
      expect(doc.save).toHaveBeenCalled();
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(doc.storageKey);
    });

    it("skips save and deleteFile when already inactive", async () => {
      const doc = {
        _id: docObjectId,
        shipmentId: new Types.ObjectId(mockShipmentId),
        ledgerLineId: new Types.ObjectId(mockLineId),
        storageKey: "k",
        isActive: false,
        save: jest.fn(),
      };
      mockLedgerDocumentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      });

      const result = await service.deleteLedgerDocument(
        mockShipmentId,
        mockLineId,
        docObjectId.toString(),
      );

      expect(result).toEqual({
        documentId: docObjectId.toString(),
        isActive: false,
      });
      expect(doc.save).not.toHaveBeenCalled();
      expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
    });
  });
});
