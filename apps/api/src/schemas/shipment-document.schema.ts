import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type ShipmentDocumentDocument = HydratedDocument<ShipmentDocument>;

/**
 * Document type enum
 */
export enum DocumentType {
  MBL = "MBL", // Master Bill of Lading
  HBL = "HBL", // House Bill of Lading
  BL = "BL", // Bill of Lading (generic)
  CARTA_PORTE = "CARTA_PORTE", // Carta Porte (Land transport)
  MANIFIESTO_CARGA = "MANIFIESTO_CARGA", // Manifesto de Carga (Land transport)
  HAWB = "HAWB", // House Air Waybill
  COMMERCIAL_INVOICE = "COMMERCIAL_INVOICE",
  PACKING_LIST = "PACKING_LIST",
  DEBIT_PDF = "DEBIT_PDF",
  CREDIT_PDF = "CREDIT_PDF",
}

/**
 * Document status enum
 */
export enum DocumentStatus {
  GENERATED = "GENERATED",
  LOCKED = "LOCKED",
  FAILED = "FAILED",
}

/**
 * Shipment Document Schema
 * Tracks each generated document (HBL, CI, PL, Debit PDF, etc.) with versioning and locking.
 */
@Schema({ timestamps: true, collection: "shipment_documents" })
export class ShipmentDocument {
  @Prop({
    type: Types.ObjectId,
    ref: "Shipment",
    required: true,
  })
  shipmentId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(DocumentType),
    required: true,
  })
  documentType: DocumentType;

  @Prop({
    type: Number,
    required: true,
    default: 1,
    min: 1,
  })
  version: number; // Starts at 1

  @Prop({
    type: String,
    enum: Object.values(DocumentStatus),
    required: true,
    default: DocumentStatus.GENERATED,
  })
  status: DocumentStatus;

  // =============================================================================
  // STORAGE
  // =============================================================================

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  storageKey: string; // Relative path: shipments/{shipmentId}/{documentType}/v{version}.pdf

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  storagePath?: string; // Full local path (deprecated, use storageKey)

  @Prop({
    type: String,
    required: true,
    default: "application/pdf",
    trim: true,
  })
  mimeType: string;

  @Prop({
    type: Number,
    required: false,
  })
  fileSize?: number; // Size in bytes

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  hash?: string; // Optional integrity check (e.g., MD5, SHA256)

  // =============================================================================
  // CONTROL
  // =============================================================================

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: true,
  })
  generatedBy: Types.ObjectId;

  @Prop({
    type: Date,
    required: true,
    default: Date.now,
  })
  generatedAt: Date;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: false,
  })
  lockedBy?: Types.ObjectId;

  @Prop({
    type: Date,
    required: false,
  })
  lockedAt?: Date;

  @Prop({
    type: Date,
    required: false,
  })
  shipmentUpdatedAtSnapshot?: Date; // Snapshot of shipment.updatedAt when document was generated

  // =============================================================================
  // FAILURE (optional but recommended)
  // =============================================================================

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  errorMessage?: string;

  @Prop({
    type: Date,
    required: false,
  })
  errorAt?: Date;
}

export const ShipmentDocumentSchema =
  SchemaFactory.createForClass(ShipmentDocument);

// Create indexes for efficient queries

// Unique constraint: (shipmentId, documentType, version)
ShipmentDocumentSchema.index(
  { shipmentId: 1, documentType: 1, version: 1 },
  { unique: true },
);

// Index for querying by shipment, document type, and status
ShipmentDocumentSchema.index({ shipmentId: 1, documentType: 1, status: 1 });

// Index for querying by shipment and status
ShipmentDocumentSchema.index({ shipmentId: 1, status: 1 });

// Index for querying by document type
ShipmentDocumentSchema.index({ documentType: 1 });

// Index for querying by generated date
ShipmentDocumentSchema.index({ generatedAt: -1 });

// Index for querying locked documents
ShipmentDocumentSchema.index({ lockedBy: 1, lockedAt: -1 });