import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { SchemaTypes } from "mongoose";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mongoose = require("mongoose");

export type QuotationDeliveryDocument = HydratedDocument<QuotationDelivery>;

export interface QuotationDeliveryOperator {
  id: Types.ObjectId;
  email?: string;
  name?: string;
}

/**
 * Tracks when a quotation was sent to a client.
 * Stores a full snapshot of the quotation at send time (historical source of truth).
 */
@Schema({ timestamps: true, collection: "quotation_deliveries" })
export class QuotationDelivery {
  @Prop({
    type: Types.ObjectId,
    ref: "Quotation",
    required: true,
  })
  quotationId: Types.ObjectId;

  @Prop({
    type: SchemaTypes.Mixed,
    required: true,
  })
  quotationSnapshot: Record<string, unknown>;

  @Prop({
    type: Types.ObjectId,
    ref: "Client",
    required: true,
  })
  clientId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: true,
  })
  sentBy: Types.ObjectId;

  @Prop({
    type: {
      id: { type: Types.ObjectId, ref: "User", required: true },
      email: { type: String, required: false, trim: true },
      name: { type: String, required: false, trim: true },
    },
    required: false,
  })
  operator?: QuotationDeliveryOperator;

  @Prop({
    type: Date,
    required: true,
    default: () => new Date(),
  })
  sentAt: Date;

  @Prop({
    type: Types.ObjectId,
    ref: "Company",
    required: true,
  })
  companyId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "Office",
    required: false,
  })
  officeId?: Types.ObjectId;

  @Prop({
    type: Boolean,
    default: true,
  })
  isActive: boolean;

  @Prop({
    type: mongoose.Schema.Types.Buffer,
    required: false,
  })
  pdfData?: Buffer;
}

export const QuotationDeliverySchema =
  SchemaFactory.createForClass(QuotationDelivery);

QuotationDeliverySchema.index({ quotationId: 1 });
QuotationDeliverySchema.index({ quotationId: 1, sentAt: -1 });
QuotationDeliverySchema.index({ quotationId: 1, clientId: 1, sentAt: -1 });
QuotationDeliverySchema.index({ clientId: 1 });
QuotationDeliverySchema.index({ companyId: 1 });
QuotationDeliverySchema.index({ sentAt: -1 });
QuotationDeliverySchema.index({ sentBy: 1 });
QuotationDeliverySchema.index({ "operator.id": 1 });
QuotationDeliverySchema.index({ officeId: 1 });
