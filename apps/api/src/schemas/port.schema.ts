import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type PortDocument = HydratedDocument<Port>;

export type PortType = "sea" | "air" | "rail" | "inland" | "other";

@Schema({ timestamps: true, collection: "ports" })
export class Port {
  @Prop({ required: true, trim: true })
  name: string; // e.g., "Shanghai", "Puerto Cortés"

  @Prop({ trim: true, uppercase: true })
  unlocode?: string; // e.g., "CNSHA" (UN/LOCODE)

  @Prop({ trim: true, uppercase: true, length: 2 })
  countryCode?: string; // ISO 3166-1 alpha-2, e.g., "CN", "HN"

  @Prop({ trim: true })
  countryName?: string;

  @Prop({ trim: true })
  city?: string;

  @Prop({
    type: String,
    enum: ["sea", "air", "rail", "inland", "other"],
    required: true,
  })
  type: PortType; // "sea", "air", etc.

  @Prop({ type: Number })
  latitude?: number;

  @Prop({ type: Number })
  longitude?: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const PortSchema = SchemaFactory.createForClass(Port);

// Create indexes
PortSchema.index({ name: 1 });
PortSchema.index({ unlocode: 1 });
PortSchema.index({ countryCode: 1 });
PortSchema.index({ type: 1 });
PortSchema.index({ isActive: 1 });
PortSchema.index({ createdAt: -1 });
PortSchema.index({ name: 1, countryCode: 1 }); // Compound index for common queries

