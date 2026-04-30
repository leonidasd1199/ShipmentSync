import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type AgentDocument = HydratedDocument<Agent>;

@Schema({ timestamps: true, collection: "agents" })
export class Agent {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ trim: true })
  whatsapp?: string;

  @Prop({
    type: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String },
      zipCode: { type: String },
      country: { type: String, required: true },
    },
    required: true,
  })
  address: {
    street: string;
    city: string;
    state?: string;
    zipCode?: string;
    country: string;
  };

  @Prop({ trim: true })
  notes?: string;

  // DEPRECATED: Use shippingLineIds instead
  @Prop({
    type: Types.ObjectId,
    ref: "Shipping",
    required: false,
  })
  shippingLineId?: Types.ObjectId;

  // NEW: Multiple suppliers support
  @Prop({
    type: [{ type: Types.ObjectId, ref: "Shipping" }],
    default: [],
  })
  shippingLineIds: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;
}

export const AgentSchema = SchemaFactory.createForClass(Agent);

// Create indexes
AgentSchema.index({ email: 1 }, { unique: true });
AgentSchema.index({ shippingLineId: 1 });
AgentSchema.index({ shippingLineIds: 1 });
AgentSchema.index({ firstName: 1, lastName: 1 });
AgentSchema.index({ isActive: 1 });
AgentSchema.index({ createdAt: -1 });

// Virtual to populate shipping lines
AgentSchema.virtual("shippingLines", {
  ref: "Shipping",
  localField: "shippingLineIds",
  foreignField: "_id",
});

// Ensure virtuals are included in JSON
AgentSchema.set("toJSON", { virtuals: true });
AgentSchema.set("toObject", { virtuals: true });