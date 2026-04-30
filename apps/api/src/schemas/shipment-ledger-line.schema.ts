import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type ShipmentLedgerLineDocument = HydratedDocument<ShipmentLedgerLine>;

/**
 * Ledger side enum
 */
export enum LedgerSide {
  DEBIT = "DEBIT", // Costs
  CREDIT = "CREDIT", // Income
}

/**
 * Ledger line status enum
 */
export enum LedgerLineStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

/**
 * Ledger line source enum
 */
export enum LedgerLineSource {
  QUOTATION_ITEM = "QUOTATION_ITEM", // Imported from quotation
  MANUAL = "MANUAL", // Manually created
}

/**
 * Shipment Ledger Line Schema
 * Financial "engine": all debits (costs) and credits (income) as lines with approval workflow.
 * Profit comes from approved totals.
 */
@Schema({ timestamps: true, collection: "shipment_ledger_lines" })
export class ShipmentLedgerLine {
  @Prop({
    type: Types.ObjectId,
    ref: "Shipment",
    required: true,
  })
  shipmentId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "Shipping",
    required: false,
  })
  supplierId?: Types.ObjectId;

  // =============================================================================
  // ACCOUNTING
  // =============================================================================

  @Prop({
    type: String,
    enum: Object.values(LedgerSide),
    required: true,
  })
  side: LedgerSide;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  description: string;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  amount: number;

  @Prop({
    type: String,
    required: true,
    trim: true,
    default: "USD",
  })
  currency: string;

  // FX / Base currency (recommended)
  @Prop({
    type: String,
    required: true,
    trim: true,
    default: "USD",
  })
  baseCurrency: string; // e.g., company base currency

  @Prop({
    type: Number,
    required: true,
    default: 1.0,
    min: 0,
  })
  fxRate: number; // Exchange rate

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  baseAmount: number; // amount * fxRate

  // =============================================================================
  // WORKFLOW
  // =============================================================================

  @Prop({
    type: String,
    enum: Object.values(LedgerLineStatus),
    required: true,
    default: LedgerLineStatus.DRAFT,
  })
  status: LedgerLineStatus;

  @Prop({
    type: Date,
    required: false,
  })
  submittedAt?: Date;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: false,
  })
  submittedBy?: Types.ObjectId;

  @Prop({
    type: Date,
    required: false,
  })
  approvedAt?: Date;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: false,
  })
  approvedBy?: Types.ObjectId;

  @Prop({
    type: Date,
    required: false,
  })
  rejectedAt?: Date;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: false,
  })
  rejectedBy?: Types.ObjectId;

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  rejectedReason?: string;

  // =============================================================================
  // SOURCE (traceability)
  // =============================================================================

  @Prop({
    type: String,
    enum: Object.values(LedgerLineSource),
    required: true,
    default: LedgerLineSource.MANUAL,
  })
  source: LedgerLineSource;

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  sourceRefId?: string; // Quotation item id or other reference

  @Prop({
    type: Types.ObjectId,
    ref: "Quotation",
    required: false,
  })
  sourceQuotationId?: Types.ObjectId; // Helpful when importing

  // =============================================================================
  // AUDIT (handled by timestamps: true)
  // =============================================================================
  // createdAt and updatedAt are automatically added by timestamps: true

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: true,
  })
  createdBy: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: false,
  })
  updatedBy?: Types.ObjectId;
}

export const ShipmentLedgerLineSchema =
  SchemaFactory.createForClass(ShipmentLedgerLine);

// Create indexes for efficient queries

// Index for querying by shipment, side, and status
ShipmentLedgerLineSchema.index({ shipmentId: 1, side: 1, status: 1 });

// Index for querying by shipment and status
ShipmentLedgerLineSchema.index({ shipmentId: 1, status: 1 });

// Index for querying by supplier and status
ShipmentLedgerLineSchema.index({ supplierId: 1, status: 1 });

// Index for querying by source quotation
ShipmentLedgerLineSchema.index({ sourceQuotationId: 1 });

// Index for querying by side
ShipmentLedgerLineSchema.index({ side: 1, status: 1 });

// Index for querying by created date
ShipmentLedgerLineSchema.index({ createdAt: -1 });