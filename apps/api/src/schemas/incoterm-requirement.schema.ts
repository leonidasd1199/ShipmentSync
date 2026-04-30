import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type IncotermRequirementDocument =
  HydratedDocument<IncotermRequirement>;

/**
 * Shipment mode enum (matches ShipmentMode from shipment.schema.ts)
 */
export enum RequirementMode {
  OCEAN = "OCEAN",
  AIR = "AIR",
  LAND = "LAND",
  MULTIMODAL = "MULTIMODAL",
  MARITIME = "MARITIME", // Alternative name for OCEAN
}

/**
 * Document type enum (matches DocumentType from shipment-document.schema.ts)
 */
export enum RequirementDocumentType {
  MBL = "MBL",
  HBL = "HBL",
  COMMERCIAL_INVOICE = "COMMERCIAL_INVOICE",
  PACKING_LIST = "PACKING_LIST",
  DEBIT_PDF = "DEBIT_PDF",
  CREDIT_PDF = "CREDIT_PDF",
}

/**
 * Incoterm Requirement Schema
 * Configuration data from Excel that drives:
 * - What fields are required
 * - What documents are required
 * - What to validate before status transitions
 */
@Schema({ timestamps: true, collection: "incoterm_requirements" })
export class IncotermRequirement {
  @Prop({
    type: String,
    enum: Object.values(RequirementMode),
    required: true,
  })
  mode: RequirementMode;

  @Prop({
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  })
  incoterm: string; // e.g., "FOB", "CIF", "EXW", etc.

  // =============================================================================
  // RULES
  // =============================================================================

  @Prop({
    type: [String],
    required: true,
    default: [],
  })
  requiredFields: string[]; // Strings pointing to keys
  // Examples:
  // "transport.vesselName"
  // "transport.voyageNumber"
  // "transport.portOfLoadingId"
  // "cargo.containers"
  // "cargo.goodsDescription"

  @Prop({
    type: [String],
    enum: Object.values(RequirementDocumentType),
    required: true,
    default: [],
  })
  requiredDocuments: RequirementDocumentType[]; // e.g., ["HBL", "COMMERCIAL_INVOICE", "PACKING_LIST"]

  // =============================================================================
  // OPTIONAL EXTENSIONS (nice-to-have)
  // =============================================================================

  @Prop({
    type: [String],
    enum: Object.values(RequirementDocumentType),
    required: false,
    default: [],
  })
  optionalDocuments?: RequirementDocumentType[];

  @Prop({
    type: [String],
    required: false,
    default: [],
  })
  requiredForReadyForFinance?: string[]; // Different thresholds for READY_FOR_FINANCE status

  @Prop({
    type: Boolean,
    required: true,
    default: true,
  })
  active: boolean; // Whether this requirement is active

  // =============================================================================
  // AUDIT (handled by timestamps: true)
  // =============================================================================
  // createdAt and updatedAt are automatically added by timestamps: true

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  createdBy?: string; // User ID or name

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  updatedBy?: string; // User ID or name
}

export const IncotermRequirementSchema =
  SchemaFactory.createForClass(IncotermRequirement);

// Create indexes for efficient queries

// Unique constraint: (mode, incoterm)
IncotermRequirementSchema.index(
  { mode: 1, incoterm: 1 },
  { unique: true },
);

// Index for querying active requirements
IncotermRequirementSchema.index({ active: 1, mode: 1 });

// Index for querying by mode
IncotermRequirementSchema.index({ mode: 1 });

// Index for querying by incoterm
IncotermRequirementSchema.index({ incoterm: 1 });