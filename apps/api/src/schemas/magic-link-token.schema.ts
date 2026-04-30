import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type MagicLinkTokenDocument = HydratedDocument<MagicLinkToken>;

@Schema({ timestamps: true, collection: "magic_link_tokens" })
export class MagicLinkToken {
  @Prop({
    type: Types.ObjectId,
    ref: "Agent",
    required: true,
  })
  agentId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
  })
  token: string; // Hashed token

  @Prop({
    type: Date,
    required: true,
  })
  expiresAt: Date;

  @Prop({
    type: Boolean,
    default: false,
  })
  revoked: boolean; // Manually revoked by admin

  @Prop({
    type: Number,
    default: 0,
  })
  useCount: number; // Track how many times the link has been used

  @Prop({
    type: Date,
  })
  lastUsedAt?: Date; // Last time the link was used

  @Prop({
    type: String,
  })
  lastUsedByIp?: string; // Track last IP for security

  @Prop({
    type: [
      {
        usedAt: { type: Date, required: true },
        usedByIp: { type: String },
      },
    ],
    default: [],
  })
  usageHistory: Array<{
    usedAt: Date;
    usedByIp?: string;
  }>;

  @Prop({
    type: String,
    enum: ["onboarding", "support", "temporary"],
    default: "temporary",
  })
  purpose: "onboarding" | "support" | "temporary";

  @Prop({
    type: String,
  })
  createdBy?: string; // User email who created the link

  @Prop({
    type: String,
  })
  notes?: string; // Optional notes about the link purpose

  // DEPRECATED: Use revoked instead
  @Prop({
    type: Boolean,
    default: false,
  })
  used: boolean;

  @Prop({
    type: Date,
  })
  usedAt?: Date;

  @Prop({
    type: String,
  })
  usedByIp?: string;

  // Timestamps are automatically added by Mongoose when timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

export const MagicLinkTokenSchema =
  SchemaFactory.createForClass(MagicLinkToken);

// Create indexes
MagicLinkTokenSchema.index({ agentId: 1, revoked: 1 });
MagicLinkTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
MagicLinkTokenSchema.index({ token: 1 }, { unique: true });