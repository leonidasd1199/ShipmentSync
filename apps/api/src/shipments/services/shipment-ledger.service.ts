import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  ShipmentLedgerLine,
  ShipmentLedgerLineDocument,
  LedgerSide,
  LedgerLineStatus,
  LedgerLineSource,
} from "../../schemas/shipment-ledger-line.schema";
import { Shipment } from "../../schemas/shipment.schema";
import { Quotation } from "../../schemas/quotation.schema";
import { Shipping } from "../../schemas/shipping.schema";
import {
  CreateLedgerLineDto,
  UpdateLedgerLineDto,
  ImportLedgerFromQuotationDto,
  RejectLedgerLineDto,
} from "../dto";
import {
  ShipmentLedgerDocument,
  ShipmentLedgerDocumentDocument,
} from "../../schemas/shipment-ledger-document.schema";
import { StorageService } from "./storage.service";

type LedgerSupplierResponse = {
  id: string;
  name?: string;
};

export type ShipmentLedgerLineResponse = {
  supplierId?: string;
  supplier?: LedgerSupplierResponse;
  /** Present on GET …/ledgerLines: count of active shipment_ledger_documents for this line */
  documentsCount?: number;
  hasDocuments?: boolean;
  [key: string]: unknown;
};

export type ShipmentLedgerDocumentResponse = {
  _id: string;
  shipmentId: string;
  ledgerLineId: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  note?: string;
};

export type DeleteLedgerDocumentResult = {
  documentId: string;
  isActive: boolean;
};

/** Multer file shape from FileInterceptor (no @types/multer required). */
export type LedgerUploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  size: number;
};

const LEDGER_DOCUMENT_ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

@Injectable()
export class ShipmentLedgerService {
  constructor(
    @InjectModel(ShipmentLedgerLine.name)
    private ledgerLineModel: Model<ShipmentLedgerLineDocument>,
    @InjectModel(ShipmentLedgerDocument.name)
    private ledgerDocumentModel: Model<ShipmentLedgerDocumentDocument>,
    @InjectModel(Shipment.name)
    private shipmentModel: Model<Shipment>,
    @InjectModel(Quotation.name)
    private quotationModel: Model<Quotation>,
    @InjectModel(Shipping.name)
    private shippingModel: Model<Shipping>,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Find all ledger lines for a shipment
   */
  async findByShipmentId(
    shipmentId: string,
    filters?: { side?: LedgerSide; status?: LedgerLineStatus },
  ): Promise<ShipmentLedgerLineResponse[]> {
    const query: any = { shipmentId: new Types.ObjectId(shipmentId) };

    if (filters?.side) {
      query.side = filters.side;
    }
    if (filters?.status) {
      query.status = filters.status;
    }

    const lines = await this.ledgerLineModel.find(query).sort({ createdAt: 1 }).exec();
    const documentCountsByLineId =
      lines.length === 0
        ? new Map<string, number>()
        : await this.countActiveDocumentsByLedgerLineId(shipmentId);
    return this.toLedgerLineResponses(lines, documentCountsByLineId);
  }

  /**
   * Find one ledger line
   */
  async findOne(lineId: string): Promise<ShipmentLedgerLineDocument> {
    const line = await this.ledgerLineModel.findById(lineId).exec();
    if (!line) {
      throw new NotFoundException(`Ledger line with id ${lineId} not found`);
    }
    return line;
  }

  /**
   * Create a manual ledger line
   */
  async create(
    shipmentId: string,
    dto: CreateLedgerLineDto,
    userId: string,
  ): Promise<ShipmentLedgerLineResponse> {
    // Verify shipment exists
    const shipment = await this.shipmentModel.findById(shipmentId).exec();
    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${shipmentId} not found`);
    }

    const baseCurrency = dto.baseCurrency || dto.currency;
    const fxRate = dto.fxRate || 1.0;
    const baseAmount = dto.amount * fxRate;

    const resolvedSupplierId = dto.supplierId
      ? new Types.ObjectId(dto.supplierId)
      : shipment.shippingLineId
        ? new Types.ObjectId(shipment.shippingLineId)
        : undefined;

    const line = await this.ledgerLineModel.create({
      shipmentId: new Types.ObjectId(shipmentId),
      supplierId: resolvedSupplierId,
      side: dto.side,
      description: dto.description,
      amount: dto.amount,
      currency: dto.currency,
      baseCurrency,
      fxRate,
      baseAmount,
      status: LedgerLineStatus.DRAFT,
      source: LedgerLineSource.MANUAL,
      createdBy: new Types.ObjectId(userId),
    });
    return this.toLedgerLineResponse(line);
  }

  /**
   * Update a ledger line (only if DRAFT)
   */
  async update(
    lineId: string,
    dto: UpdateLedgerLineDto,
    userId: string,
  ): Promise<ShipmentLedgerLineResponse> {
    const line = await this.findOne(lineId);

    if (line.status !== LedgerLineStatus.DRAFT) {
      throw new ForbiddenException(
        `Cannot update ledger line with status ${line.status}. Only DRAFT lines can be updated.`,
      );
    }

    const updateData: any = {
      ...dto,
      updatedBy: new Types.ObjectId(userId),
    };

    // Recalculate baseAmount if amount or fxRate changed
    if (dto.amount !== undefined || dto.fxRate !== undefined) {
      const amount = dto.amount ?? line.amount;
      const fxRate = dto.fxRate ?? line.fxRate;
      const baseCurrency = dto.baseCurrency || line.baseCurrency || line.currency;
      updateData.baseAmount = amount * fxRate;
      updateData.baseCurrency = baseCurrency;
      if (dto.fxRate !== undefined) {
        updateData.fxRate = fxRate;
      }
      if (dto.amount !== undefined) {
        updateData.amount = amount;
      }
    }

    const updated = await this.ledgerLineModel
      .findByIdAndUpdate(lineId, updateData, { new: true })
      .exec();
    
    if (!updated) {
      throw new NotFoundException(`Ledger line with id ${lineId} not found`);
    }
    
    return this.toLedgerLineResponse(updated);
  }

  /**
   * Delete a ledger line (only if DRAFT)
   */
  async delete(lineId: string): Promise<void> {
    const line = await this.findOne(lineId);

    if (line.status !== LedgerLineStatus.DRAFT) {
      throw new ForbiddenException(
        `Cannot delete ledger line with status ${line.status}. Only DRAFT lines can be deleted.`,
      );
    }

    await this.ledgerLineModel.findByIdAndDelete(lineId).exec();
  }

  /**
   * Import ledger lines from quotation items
   */
  async importFromQuotation(
    shipmentId: string,
    dto: ImportLedgerFromQuotationDto,
    userId: string,
  ): Promise<ShipmentLedgerLineResponse[]> {
    // Verify shipment exists
    const shipment = await this.shipmentModel.findById(shipmentId).exec();
    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${shipmentId} not found`);
    }

    // Verify quotation exists
    const quotation = await this.quotationModel
      .findById(dto.quotationId)
      .exec();
    if (!quotation) {
      throw new NotFoundException(
        `Quotation with id ${dto.quotationId} not found`,
      );
    }

    // Get quotation items
    const items = quotation.items || [];
    const itemMap = new Map(
      items.map((item: any) => [item.itemId || item._id?.toString(), item]),
    );

    // Validate all itemIds belong to quotation
    const invalidItems: string[] = [];
    for (const itemId of dto.itemIds) {
      if (!itemMap.has(itemId)) {
        invalidItems.push(itemId);
      }
    }

    if (invalidItems.length > 0) {
      throw new BadRequestException({
        message: "Some item IDs do not belong to the quotation",
        invalidItems,
      });
    }

    // Create ledger lines from items
    const ledgerLines: ShipmentLedgerLineDocument[] = [];

    for (const itemId of dto.itemIds) {
      const item = itemMap.get(itemId);
      if (!item) continue;

      // Determine side: if item has type/side field use it, otherwise default to DEBIT
      // TODO: Check if quotation items have a side/type field
      const side = LedgerSide.DEBIT; // Default to DEBIT for imported items

      const amount = typeof item.price === "number" ? item.price : 0;
      const currency = quotation.pricingConfig?.currency || "USD";
      const baseCurrency = currency;
      const fxRate = 1.0; // TODO: Get actual FX rate if available
      const baseAmount = amount * fxRate;

      const ledgerLine = await this.ledgerLineModel.create({
        shipmentId: new Types.ObjectId(shipmentId),
        supplierId: shipment.shippingLineId
          ? new Types.ObjectId(shipment.shippingLineId)
          : undefined,
        side,
        description: item.description || `Item ${itemId}`,
        amount,
        currency,
        baseCurrency,
        fxRate,
        baseAmount,
        status: LedgerLineStatus.DRAFT,
        source: LedgerLineSource.QUOTATION_ITEM,
        sourceRefId: itemId,
        sourceQuotationId: new Types.ObjectId(dto.quotationId),
        createdBy: new Types.ObjectId(userId),
      });

      ledgerLines.push(ledgerLine);
    }

    return this.toLedgerLineResponses(ledgerLines);
  }

  /**
   * Submit ledger line for approval
   */
  async submit(lineId: string, userId: string): Promise<ShipmentLedgerLineResponse> {
    const line = await this.findOne(lineId);

    if (line.status !== LedgerLineStatus.DRAFT) {
      throw new BadRequestException(
        `Ledger line must be in DRAFT status. Current status: ${line.status}`,
      );
    }

    const updated = await this.ledgerLineModel
      .findByIdAndUpdate(
        lineId,
        {
          status: LedgerLineStatus.SUBMITTED,
          submittedAt: new Date(),
          submittedBy: new Types.ObjectId(userId),
          updatedBy: new Types.ObjectId(userId),
        },
        { new: true },
      )
      .exec();
    
    if (!updated) {
      throw new NotFoundException(`Ledger line with id ${lineId} not found`);
    }
    
    return this.toLedgerLineResponse(updated);
  }

  /**
   * Approve ledger line
   */
  async approve(lineId: string, userId: string): Promise<ShipmentLedgerLineResponse> {
    const line = await this.findOne(lineId);

    if (line.status !== LedgerLineStatus.SUBMITTED) {
      throw new BadRequestException(
        `Ledger line must be in SUBMITTED status. Current status: ${line.status}`,
      );
    }

    const updated = await this.ledgerLineModel
      .findByIdAndUpdate(
        lineId,
        {
          status: LedgerLineStatus.APPROVED,
          approvedAt: new Date(),
          approvedBy: new Types.ObjectId(userId),
          updatedBy: new Types.ObjectId(userId),
        },
        { new: true },
      )
      .exec();
    
    if (!updated) {
      throw new NotFoundException(`Ledger line with id ${lineId} not found`);
    }
    
    return this.toLedgerLineResponse(updated);
  }

  /**
   * Reject ledger line
   */
  async reject(
    lineId: string,
    dto: RejectLedgerLineDto,
    userId: string,
  ): Promise<ShipmentLedgerLineResponse> {
    const line = await this.findOne(lineId);

    if (line.status !== LedgerLineStatus.SUBMITTED) {
      throw new BadRequestException(
        `Ledger line must be in SUBMITTED status. Current status: ${line.status}`,
      );
    }

    const updated = await this.ledgerLineModel
      .findByIdAndUpdate(
        lineId,
        {
          status: LedgerLineStatus.REJECTED,
          rejectedAt: new Date(),
          rejectedBy: new Types.ObjectId(userId),
          rejectedReason: dto.reason,
          updatedBy: new Types.ObjectId(userId),
        },
        { new: true },
      )
      .exec();
    
    if (!updated) {
      throw new NotFoundException(`Ledger line with id ${lineId} not found`);
    }
    
    return this.toLedgerLineResponse(updated);
  }

  /**
   * Calculate profit from approved ledger lines
   */
  async calculateProfit(shipmentId: string): Promise<{
    debitTotal: number;
    creditTotal: number;
    profit: number;
    debits: ShipmentLedgerLineResponse[];
    credits: ShipmentLedgerLineResponse[];
  }> {
    const approvedLines = await this.ledgerLineModel
      .find({
        shipmentId: new Types.ObjectId(shipmentId),
        status: LedgerLineStatus.APPROVED,
      })
      .exec();

    const debits = approvedLines.filter(
      (line) => line.side === LedgerSide.DEBIT,
    );
    const credits = approvedLines.filter(
      (line) => line.side === LedgerSide.CREDIT,
    );

    const debitTotal = debits.reduce((sum, line) => sum + line.amount, 0);
    const creditTotal = credits.reduce((sum, line) => sum + line.amount, 0);
    const profit = creditTotal - debitTotal;

    const [debitResponses, creditResponses] = await Promise.all([
      this.toLedgerLineResponses(debits),
      this.toLedgerLineResponses(credits),
    ]);

    return {
      debitTotal,
      creditTotal,
      profit,
      debits: debitResponses,
      credits: creditResponses,
    };
  }

  /**
   * Upload a supporting document for a DEBIT or CREDIT ledger line.
   */
  async uploadLedgerDocument(
    shipmentId: string,
    ledgerLineId: string,
    file: LedgerUploadedFile | undefined,
    userId: string,
    note?: string,
  ): Promise<ShipmentLedgerDocumentResponse> {
    await this.ensureShipmentExists(shipmentId);
    await this.ensureLedgerLineBelongsToShipmentForDocuments(
      shipmentId,
      ledgerLineId,
    );

    const normalizedNote = this.normalizeLedgerDocumentNote(note);

    if (!file?.buffer?.length) {
      throw new BadRequestException("File is required");
    }

    const mime = (file.mimetype || "").toLowerCase().split(";")[0].trim();
    if (!LEDGER_DOCUMENT_ALLOWED_MIMES.has(mime)) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${[...LEDGER_DOCUMENT_ALLOWED_MIMES].join(", ")}`,
      );
    }

    const maxBytes = 15 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File too large. Maximum size is ${maxBytes} bytes`,
      );
    }

    const docId = new Types.ObjectId();
    const ext = this.extensionFromOriginalName(file.originalname);
    const storedFileName = `${docId.toString()}${ext}`;
    const storageKey = this.storageService.generateLedgerDocumentStorageKey(
      shipmentId,
      ledgerLineId,
      storedFileName,
    );

    await this.storageService.saveFile(storageKey, file.buffer);

    const originalFileName = this.sanitizeOriginalFileName(file.originalname);

    const created = await this.ledgerDocumentModel.create({
      _id: docId,
      shipmentId: new Types.ObjectId(shipmentId),
      ledgerLineId: new Types.ObjectId(ledgerLineId),
      fileName: storedFileName,
      originalFileName,
      mimeType: mime,
      size: file.size,
      storageKey,
      uploadedBy: new Types.ObjectId(userId),
      isActive: true,
      ...(normalizedNote !== undefined ? { note: normalizedNote } : {}),
    });

    return this.toLedgerDocumentResponse(created);
  }

  /**
   * List active supporting documents for a ledger line (DEBIT or CREDIT), newest first.
   */
  async listLedgerDocuments(
    shipmentId: string,
    ledgerLineId: string,
  ): Promise<ShipmentLedgerDocumentResponse[]> {
    await this.ensureShipmentExists(shipmentId);
    await this.ensureLedgerLineBelongsToShipmentForDocuments(
      shipmentId,
      ledgerLineId,
    );

    const docs = await this.ledgerDocumentModel
      .find({
        shipmentId: new Types.ObjectId(shipmentId),
        ledgerLineId: new Types.ObjectId(ledgerLineId),
        isActive: true,
      })
      .sort({ createdAt: -1 })
      .exec();

    return docs.map((d) => this.toLedgerDocumentResponse(d));
  }

  /**
   * Read file bytes for an active ledger supporting document
   */
  async downloadLedgerDocumentFile(
    shipmentId: string,
    ledgerLineId: string,
    documentId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; originalFileName: string }> {
    await this.ensureShipmentExists(shipmentId);
    await this.ensureLedgerLineBelongsToShipmentForDocuments(
      shipmentId,
      ledgerLineId,
    );

    const doc = await this.ledgerDocumentModel.findById(documentId).exec();
    if (!doc) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }

    if (doc.shipmentId.toString() !== shipmentId) {
      throw new BadRequestException(
        "Document does not belong to this shipment",
      );
    }

    if (doc.ledgerLineId.toString() !== ledgerLineId) {
      throw new BadRequestException(
        "Document does not belong to this ledger line",
      );
    }

    if (!doc.isActive) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }

    const buffer = await this.storageService.readFile(doc.storageKey);
    return {
      buffer,
      mimeType: doc.mimeType,
      originalFileName: doc.originalFileName,
    };
  }

  /**
   * Soft-delete a supporting document for a ledger line (DEBIT or CREDIT); best-effort file removal.
   */
  async deleteLedgerDocument(
    shipmentId: string,
    ledgerLineId: string,
    documentId: string,
  ): Promise<DeleteLedgerDocumentResult> {
    await this.ensureShipmentExists(shipmentId);
    await this.ensureLedgerLineBelongsToShipmentForDocuments(
      shipmentId,
      ledgerLineId,
    );

    const doc = await this.ledgerDocumentModel.findById(documentId).exec();
    if (!doc) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }

    if (doc.shipmentId.toString() !== shipmentId) {
      throw new BadRequestException(
        "Document does not belong to this shipment",
      );
    }

    if (doc.ledgerLineId.toString() !== ledgerLineId) {
      throw new BadRequestException(
        "Document does not belong to this ledger line",
      );
    }

    if (doc.isActive) {
      doc.isActive = false;
      await doc.save();
      await this.storageService.deleteFile(doc.storageKey);
    }

    return { documentId: doc._id.toString(), isActive: false };
  }

  private async ensureShipmentExists(shipmentId: string): Promise<void> {
    const shipment = await this.shipmentModel.findById(shipmentId).exec();
    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${shipmentId} not found`);
    }
  }

  /**
   * Ensures the ledger line exists, belongs to the shipment, and supports attachments (DEBIT or CREDIT).
   */
  private async ensureLedgerLineBelongsToShipmentForDocuments(
    shipmentId: string,
    ledgerLineId: string,
  ): Promise<ShipmentLedgerLineDocument> {
    const line = await this.ledgerLineModel.findById(ledgerLineId).exec();
    if (!line) {
      throw new NotFoundException(`Ledger line with id ${ledgerLineId} not found`);
    }

    if (line.shipmentId.toString() !== shipmentId) {
      throw new BadRequestException(
        "Ledger line does not belong to this shipment",
      );
    }

    if (
      line.side !== LedgerSide.DEBIT &&
      line.side !== LedgerSide.CREDIT
    ) {
      throw new BadRequestException(
        "Documents can only be attached to DEBIT or CREDIT ledger lines",
      );
    }

    return line;
  }

  private extensionFromOriginalName(name: string | undefined): string {
    if (!name || typeof name !== "string") {
      return ".bin";
    }
    const i = name.lastIndexOf(".");
    if (i < 0 || i === name.length - 1) {
      return ".bin";
    }
    const ext = name.slice(i).toLowerCase().replace(/[^a-z0-9.]/g, "");
    return ext.length > 0 && ext.length <= 16 ? ext : ".bin";
  }

  private sanitizeOriginalFileName(name: string | undefined): string {
    const raw = (name || "upload").trim().replace(/[/\\]/g, "_");
    return raw.length > 255 ? raw.slice(0, 255) : raw;
  }

  private normalizeLedgerDocumentNote(
    note: string | undefined,
  ): string | undefined {
    if (note == null || typeof note !== "string") return undefined;
    const trimmed = note.trim();
    if (!trimmed) return undefined;
    const max = 4000;
    if (trimmed.length > max) {
      throw new BadRequestException(`Note must be at most ${max} characters`);
    }
    return trimmed;
  }

  private toLedgerDocumentResponse(
    doc: ShipmentLedgerDocumentDocument,
  ): ShipmentLedgerDocumentResponse {
    const plain = doc.toObject() as {
      createdAt?: Date;
      updatedAt?: Date;
    };
    return {
      _id: doc._id.toString(),
      shipmentId: doc.shipmentId.toString(),
      ledgerLineId: doc.ledgerLineId.toString(),
      fileName: doc.fileName,
      originalFileName: doc.originalFileName,
      mimeType: doc.mimeType,
      size: doc.size,
      storageKey: doc.storageKey,
      uploadedBy: doc.uploadedBy.toString(),
      createdAt: plain.createdAt ?? new Date(),
      updatedAt: plain.updatedAt ?? new Date(),
      isActive: doc.isActive,
      ...(doc.note !== undefined && doc.note !== ""
        ? { note: doc.note }
        : {}),
    };
  }

  private async toLedgerLineResponse(
    line: ShipmentLedgerLineDocument,
  ): Promise<ShipmentLedgerLineResponse> {
    const [response] = await this.toLedgerLineResponses([line]);
    return response;
  }

  private async toLedgerLineResponses(
    lines: ShipmentLedgerLineDocument[],
    documentCountsByLineId?: Map<string, number>,
  ): Promise<ShipmentLedgerLineResponse[]> {
    const supplierNameById = await this.getSupplierNameById(lines);
    return lines.map((line) =>
      this.mapLedgerLineResponse(line, supplierNameById, documentCountsByLineId),
    );
  }

  /**
   * Active document counts per ledger line for a shipment (shipment_ledger_documents).
   */
  private async countActiveDocumentsByLedgerLineId(
    shipmentId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.ledgerDocumentModel
      .aggregate<{ _id: Types.ObjectId; count: number }>([
        {
          $match: {
            shipmentId: new Types.ObjectId(shipmentId),
            isActive: true,
          },
        },
        {
          $group: {
            _id: "$ledgerLineId",
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    return new Map(
      rows.map((r) => [r._id.toString(), r.count]),
    );
  }

  private mapLedgerLineResponse(
    line: ShipmentLedgerLineDocument,
    supplierNameById: Map<string, string>,
    documentCountsByLineId?: Map<string, number>,
  ): ShipmentLedgerLineResponse {
    const response = line.toJSON() as ShipmentLedgerLineResponse;
    if (documentCountsByLineId !== undefined) {
      const lineId = line._id.toString();
      const documentsCount = documentCountsByLineId.get(lineId) ?? 0;
      response.documentsCount = documentsCount;
      response.hasDocuments = documentsCount > 0;
    }

    const supplierId = this.normalizeObjectId(response.supplierId ?? line.supplierId);

    if (!supplierId) {
      return response;
    }

    const supplierName = supplierNameById.get(supplierId);
    response.supplierId = supplierId;
    response.supplier = supplierName
      ? { id: supplierId, name: supplierName }
      : { id: supplierId };

    return response;
  }

  private async getSupplierNameById(
    lines: ShipmentLedgerLineDocument[],
  ): Promise<Map<string, string>> {
    const supplierIds = Array.from(
      new Set(
        lines
          .map((line) => this.normalizeObjectId(line.supplierId))
          .filter((supplierId): supplierId is string => Boolean(supplierId)),
      ),
    );

    if (supplierIds.length === 0) {
      return new Map();
    }

    const suppliers = await this.shippingModel
      .find({ _id: { $in: supplierIds.map((id) => new Types.ObjectId(id)) } })
      .select("_id name")
      .lean()
      .exec();

    return new Map(
      suppliers.map((supplier) => [supplier._id.toString(), supplier.name]),
    );
  }

  private normalizeObjectId(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === "string") return value;
    if (value instanceof Types.ObjectId) return value.toString();
    if (typeof value === "object" && "_id" in (value as Record<string, unknown>)) {
      const nestedId = (value as { _id?: unknown })._id;
      if (nestedId instanceof Types.ObjectId) return nestedId.toString();
      if (typeof nestedId === "string") return nestedId;
    }
    return undefined;
  }
}