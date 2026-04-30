import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type ShippingDocument = HydratedDocument<Shipping>;

@Schema({ timestamps: true, collection: "shippings" })
export class Shipping {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  legalName?: string;

  @Prop({ trim: true })
  email?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  website?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: "Agent" }], default: [] })
  agents: Types.ObjectId[];

  @Prop({
    type: [String],
    enum: ["maritime", "air", "road"],
    required: true,
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: "shippingModes must include at least one value",
    },
    description: "Shipping modes: maritime, air, road, or combinations (at least one required)",
  })
  shippingModes: ("maritime" | "air" | "road")[];

  @Prop({ default: true })
  isActive: boolean;
}

export const ShippingSchema = SchemaFactory.createForClass(Shipping);

// Create indexes
ShippingSchema.index({ name: 1 });
ShippingSchema.index({ email: 1 });
ShippingSchema.index({ isActive: 1 });
ShippingSchema.index({ shippingModes: 1 });
ShippingSchema.index({ createdAt: -1 });
