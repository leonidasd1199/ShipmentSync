import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type PricelistDistributionDocument = HydratedDocument<PricelistDistribution>;

/**
 * Schema for tracking pricelist distributions to clients
 * Stores audit trail of which pricelists were sent to which clients and when
 */
@Schema({ timestamps: true, collection: "pricelist_distributions" })
export class PricelistDistribution {
  @Prop({
    type: Types.ObjectId,
    ref: "AgentPricelist",
    required: true,
    index: true,
  })
  pricelistId: Types.ObjectId;

  @Prop({
    type: [Types.ObjectId],
    ref: "Client",
    required: true,
    default: [],
  })
  clientIds: Types.ObjectId[];

  @Prop({
    type: Boolean,
    required: true,
    default: false,
  })
  sendToAll: boolean;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: true,
  })
  sentBy: Types.ObjectId; // Operator who sent the pricelist

  @Prop({
    type: String,
    required: false,
  })
  sentByEmail?: string; // Operator email for audit

  @Prop({
    type: Date,
    required: true,
    default: Date.now,
  })
  sentAt: Date;

  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  totalClients: number; // Total number of clients distribution was sent to
}

export const PricelistDistributionSchema =
  SchemaFactory.createForClass(PricelistDistribution);

// Create indexes for efficient queries
PricelistDistributionSchema.index({ pricelistId: 1, sentAt: -1 });
PricelistDistributionSchema.index({ clientIds: 1 });
PricelistDistributionSchema.index({ sentBy: 1 });
PricelistDistributionSchema.index({ sentAt: -1 });
