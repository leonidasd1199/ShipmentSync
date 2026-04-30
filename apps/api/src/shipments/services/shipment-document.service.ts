import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  ShipmentDocument,
  ShipmentDocumentDocument,
  DocumentType,
  DocumentStatus,
} from "../../schemas/shipment-document.schema";
import { Shipment, ShipmentStatus } from "../../schemas/shipment.schema";
import { StorageService } from "./storage.service";

@Injectable()
export class ShipmentDocumentService {
  constructor(
    @InjectModel(ShipmentDocument.name)
    private documentModel: Model<ShipmentDocumentDocument>,
    @InjectModel(Shipment.name)
    private shipmentModel: Model<Shipment>,
    private storageService: StorageService,
  ) {}

  /**
   * Find all documents for a shipment
   */
  async findByShipmentId(shipmentId: string): Promise<ShipmentDocumentDocument[]> {
    return this.documentModel
      .find({ shipmentId: new Types.ObjectId(shipmentId) })
      .sort({ documentType: 1, version: -1 })
      .exec();
  }

  /**
   * Find latest version of a document type for a shipment
   */
  async findLatest(
    shipmentId: string,
    documentType: DocumentType,
  ): Promise<ShipmentDocumentDocument | null> {
    return this.documentModel
      .findOne({
        shipmentId: new Types.ObjectId(shipmentId),
        documentType,
      })
      .sort({ version: -1 })
      .exec();
  }

  /**
   * Generate a new document version
   */
  async generateDocument(
    shipmentId: string,
    documentType: DocumentType,
    userId: string,
  ): Promise<ShipmentDocumentDocument> {
    // Check shipment exists and is in DRAFT status
    const shipment = await this.shipmentModel.findById(shipmentId).exec();
    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${shipmentId} not found`);
    }

    if (shipment.status !== ShipmentStatus.DRAFT) {
      throw new ForbiddenException(
        `Cannot generate documents for shipment with status ${shipment.status}. Only DRAFT shipments allow document generation.`,
      );
    }

    // Check if document is locked
    const latest = await this.findLatest(shipmentId, documentType);
    if (latest && latest.status === DocumentStatus.LOCKED) {
      throw new ForbiddenException(
        `Document ${documentType} is locked and cannot be regenerated`,
      );
    }

    // Calculate next version
    const nextVersion = latest ? latest.version + 1 : 1;

    // Generate PDF buffer (stub implementation)
    const pdfBuffer = await this.storageService.generatePlaceholderPDF(
      shipmentId,
      documentType,
      nextVersion,
    );

    // Generate storage key
    const storageKey = this.storageService.generateStorageKey(
      shipmentId,
      documentType,
      nextVersion,
    );

    // Save file
    await this.storageService.saveFile(storageKey, pdfBuffer);

    // Create document record
    const document = await this.documentModel.create({
      shipmentId: new Types.ObjectId(shipmentId),
      documentType,
      version: nextVersion,
      status: DocumentStatus.GENERATED,
      storageKey,
      mimeType: "application/pdf",
      fileSize: pdfBuffer.length,
      generatedBy: new Types.ObjectId(userId),
      generatedAt: new Date(),
      shipmentUpdatedAtSnapshot: (shipment as any).updatedAt || new Date(),
    });

    return document;
  }

  /**
   * Lock a document
   */
  async lockDocument(
    shipmentId: string,
    documentType: DocumentType,
    userId: string,
  ): Promise<ShipmentDocumentDocument> {
    const latest = await this.findLatest(shipmentId, documentType);
    if (!latest) {
      throw new NotFoundException(
        `No ${documentType} document found for shipment ${shipmentId}`,
      );
    }

    if (latest.status === DocumentStatus.LOCKED) {
      return latest; // Already locked
    }

    const updated = await this.documentModel
      .findByIdAndUpdate(
        latest._id,
        {
          status: DocumentStatus.LOCKED,
          lockedBy: new Types.ObjectId(userId),
          lockedAt: new Date(),
        },
        { new: true },
      )
      .exec();
    
    if (!updated) {
      throw new NotFoundException(`Document with id ${latest._id} not found`);
    }
    
    return updated;
  }

  /**
   * Get document file buffer
   */
  async getDocumentFile(
    shipmentId: string,
    documentType: DocumentType,
    version?: number,
  ): Promise<Buffer> {
    let document: ShipmentDocumentDocument | null;

    if (version) {
      document = await this.documentModel
        .findOne({
          shipmentId: new Types.ObjectId(shipmentId),
          documentType,
          version,
        })
        .exec();
    } else {
      document = await this.findLatest(shipmentId, documentType);
    }

    if (!document) {
      throw new NotFoundException(
        `Document ${documentType}${version ? ` v${version}` : ""} not found for shipment ${shipmentId}`,
      );
    }

    return this.storageService.readFile(document.storageKey);
  }
}