import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type ShipmentLedgerDocumentDocument =
  HydratedDocument<ShipmentLedgerDocument>;

/**
 * Supporting files attached to a shipment ledger line (DEBIT / cost rows only).
 */
@Schema({ timestamps: true, collection: "shipment_ledger_documents" })
export class ShipmentLedgerDocument {
  @Prop({
    type: Types.ObjectId,
    ref: "Shipment",
    required: true,
  })
  shipmentId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "ShipmentLedgerLine",
    required: true,
  })
  ledgerLineId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  fileName: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  originalFileName: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  mimeType: string;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  size: number;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  storageKey: string;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: true,
  })
  uploadedBy: Types.ObjectId;

  @Prop({
    type: Boolean,
    required: true,
    default: true,
  })
  isActive: boolean;

  @Prop({
    type: String,
    required: false,
    trim: true,
    maxlength: 4000,
  })
  note?: string;
}

export const ShipmentLedgerDocumentSchema = SchemaFactory.createForClass(
  ShipmentLedgerDocument,
);

ShipmentLedgerDocumentSchema.index({ ledgerLineId: 1 });
ShipmentLedgerDocumentSchema.index({ shipmentId: 1 });
ShipmentLedgerDocumentSchema.index({ uploadedBy: 1 });
ShipmentLedgerDocumentSchema.index({ createdAt: -1 });
ShipmentLedgerDocumentSchema.index({ ledgerLineId: 1, createdAt: -1 });
