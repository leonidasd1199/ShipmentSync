import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type OfficeDocument = HydratedDocument<Office>;

@Schema({ timestamps: true, collection: "offices" })
export class Office {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    type: Types.ObjectId,
    ref: "Company",
    required: true,
  })
  company: Types.ObjectId;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    enum: [
      "headquarters",
      "warehouse",
      "operations",
      "distribution",
      "hub",
      "branch",
    ],
  })
  type?: string;

  @Prop({ trim: true })
  email?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({
    type: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zipCode: { type: String },
      country: { type: String },
    },
  })
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };

  @Prop({
    type: {
      cai: { type: String, trim: true },
      ein: { type: String, trim: true },
      email: { type: String, trim: true },
      address: {
        type: {
          street: { type: String, trim: true },
          city: { type: String, trim: true },
          state: { type: String, trim: true },
          zipCode: { type: String, trim: true },
          country: { type: String, trim: true },
        },
        _id: false,
      },
      invoiceRange: {
        type: {
          from: { type: Number },
          to: { type: Number },
        },
        _id: false,
      },
      lastUsedInvoiceNumber: { type: Number, required: false },
    },
    required: false,
    _id: false,
  })
  invoicing?: {
    cai?: string;
    ein?: string;
    email?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
    invoiceRange?: {
      from: number;
      to: number;
    };
    /** Highest invoice number already issued for this office (server-managed). */
    lastUsedInvoiceNumber?: number;
  };

  @Prop({ default: true })
  isActive: boolean;
}

export const OfficeSchema = SchemaFactory.createForClass(Office);
