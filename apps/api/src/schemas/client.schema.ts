import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type ClientDocument = HydratedDocument<Client>;

@Schema({ timestamps: true, collection: "clients" })
export class Client {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    type: Types.ObjectId,
    ref: "Office",
    required: true,
  })
  office: Types.ObjectId;

  @Prop({ trim: true })
  contactPerson?: string;

  @Prop({ trim: true, lowercase: true })
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

  @Prop({ trim: true })
  taxId?: string;

  @Prop({
    type: {
      billingAddress: {
        type: {
          street: { type: String, trim: true },
          city: { type: String, trim: true },
          state: { type: String, trim: true },
          zipCode: { type: String, trim: true },
          country: { type: String, trim: true },
        },
        _id: false,
      },
      invoiceEmail: { type: String, trim: true, lowercase: true },
      paymentTerms: { type: String, trim: true },
      taxRegimeOrVatNumber: { type: String, trim: true },
      currency: { type: String, trim: true },
      preferredPaymentMethod: { type: String, trim: true },
    },
    required: false,
    _id: false,
  })
  invoiceInformation?: {
    billingAddress: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    invoiceEmail: string;
    paymentTerms: string;
    taxRegimeOrVatNumber: string;
    currency: string;
    preferredPaymentMethod: string;
  };

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date })
  lastContactDate?: Date;

  @Prop({ type: [{ type: String }], default: [] })
  tags?: string[];
}

export const ClientSchema = SchemaFactory.createForClass(Client);

// Create indexes
ClientSchema.index({ office: 1 });
ClientSchema.index({ name: 1 });
ClientSchema.index({ isActive: 1 });
ClientSchema.index({ createdAt: -1 });
ClientSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $exists: true, $type: "string" },
    },
  },
);
