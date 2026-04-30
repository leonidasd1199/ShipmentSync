import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type CompanyDocument = HydratedDocument<Company>;

@Schema({ timestamps: true, collection: "companies" })
export class Company {
  @Prop({ required: true, trim: true, unique: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true, sparse: true })
  taxId?: string;

  @Prop({ required: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({
    type: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    required: true,
  })
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };

  @Prop({ default: true })
  isActive: boolean;

  /** Full legal name for documents (e.g. "SHIPSYNC LOGISTICS S. DE R.L.") */
  @Prop({ trim: true })
  legalName?: string;

  /** Public HTTPS URL for the company logo used on PDFs (Bill of Lading, etc.) */
  @Prop({ trim: true })
  brandLogoUrl?: string;
}

export const CompanySchema = SchemaFactory.createForClass(Company);
