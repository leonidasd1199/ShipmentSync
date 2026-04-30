import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types, Schema as MongooseSchema } from "mongoose";

export type TemplateDocument = HydratedDocument<Template>;

// Header field configuration
export interface HeaderField {
  id: string; // UUID identifier
  label: string; // e.g., "Port of Origin", "Expiration Date", "Potato", etc.
  inputType: "text" | "textarea" | "number" | "date" | "select";
  options?: string[]; // Only if inputType === "select"
  defaultValue?: any;
  required?: boolean;
  order?: number; // Order for display
}

// Item/Charge configuration (Dynamic Line Items)
export interface TemplateItem {
  id: string; // Item identifier (e.g., "1", UUID, etc.)
  label: string; // e.g., "Pick up", "DOC FEE", "Potato", etc.
  hasPrice: boolean; // Whether this item has a price field
  hasQuantity: boolean; // Whether this item has a quantity field
  hasDiscount: boolean; // Whether this item has a discount field
  defaultPrice?: number | null; // Default price value (null if not set)
  defaultQuantity?: number | null; // Default quantity value (null if not set)
  defaultDiscount?: number | null; // Default discount value (null if not set)
  notes?: string; // Item-specific note
  order?: number; // Display order
  applyTemplateDiscount?: boolean; // Should this item consider the template's general discount?
  applyTaxes?: boolean; // Does this item generate taxes?
  taxRate?: number | null; // Specific tax rate for this item (e.g., 15%, null if not set)
}

// Equipment field configuration (subfields for equipment items)
export interface TemplateEquipmentField {
  key: string; // e.g., "size", "length", "width", "height", "unit", "weightKg", etc.
  label: string; // e.g., "Size", "Length", "Width", "Height", "Unit", "Weight (kg)", etc.
  inputType: "text" | "number";
  defaultValue?: string | number | null;
  order?: number;
}

// Equipment item configuration (containers, equipment specifications)
export interface TemplateEquipmentItem {
  id: string; // Equipment identifier (e.g., "1", UUID, etc.)
  label: string; // e.g., "20DV", "40HC", "Equipment", etc.
  fields: TemplateEquipmentField[]; // Required: Configurable subfields (size, length, width, height, unit, weightKg, etc.)
  hasPrice: boolean; // Whether this equipment item has a price field
  hasQuantity: boolean; // Whether this equipment item has a quantity field
  hasDiscount: boolean; // Whether this equipment item has a discount field
  defaultPrice?: number | null; // Default price value (null if not set)
  defaultQuantity?: number | null; // Default quantity value (null if not set)
  defaultDiscount?: number | null; // Default discount value (null if not set)
  applyTemplateDiscount?: boolean; // Should this equipment item consider the template's general discount?
  applyTaxes?: boolean; // Does this equipment item generate taxes?
  taxRate?: number | null; // Specific tax rate for this equipment item (e.g., 15%, null if not set)
  order?: number; // Display order
}

// Price configuration
export interface TemplatePricingConfig {
  currency: string; // e.g., "USD", "EUR", "HNL"
  templatePrice?: number | null; // Base template price (optional)
  templateDiscount?: number | null; // Percentage discount (0-100)
  applyTemplateDiscount?: boolean; // Whether discount applies
  templateTaxRate?: number | null; // Percentage tax (0-100)
  applyTemplateTaxes?: boolean; // Whether taxes apply
}

@Schema({ timestamps: true, collection: "templates" })
export class Template {
  @Prop({ required: true, trim: true })
  name: string; // e.g., "LCL – EXW", "FCL – CIF", "AIR – DAP"

  @Prop({
    type: String,
    enum: [
      "EXW", // Ex Works
      "FCA", // Free Carrier
      "FAS", // Free Alongside Ship
      "FOB", // Free On Board
      "CFR", // Cost and Freight
      "CIF", // Cost, Insurance and Freight
      "CPT", // Carriage Paid To
      "CIP", // Carriage and Insurance Paid To
      "DAP", // Delivered At Place
      "DPU", // Delivered at Place Unloaded
      "DDP", // Delivered Duty Paid
    ],
    required: true,
    description: "Incoterm category (ICC 2020). Most commonly used: EXW, CIF, FOB, DAP, CFR",
  })
  category: string;

  @Prop({
    type: String,
    enum: [
      "FCL",
      "LCL",
      "AIR",
      "FTL",
      "INSURANCE",
      "CUSTOMS",
      "LOCAL_TRUCKING",
      "OTHER",
    ],
    required: true,
  })
  serviceType: string;

  @Prop({
    type: [String],
    enum: ["maritime", "air", "road"],
    default: [],
    description: "Modes of transportation (e.g., ['maritime'], ['air'], ['maritime', 'air'], etc.)",
  })
  shippingModes: string[];

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        inputType: { type: String, enum: ["text", "textarea", "number", "date", "select"], required: true },
        options: { type: [String], required: false },
        defaultValue: { type: MongooseSchema.Types.Mixed, required: false },
        required: { type: Boolean, default: false },
        order: { type: Number, required: false },
      },
    ],
    default: [],
  })
  headerFields: HeaderField[];

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        hasPrice: { type: Boolean, required: true },
        hasQuantity: { type: Boolean, required: true },
        hasDiscount: { type: Boolean, required: true },
        defaultPrice: { type: MongooseSchema.Types.Mixed, required: false }, // Can be number or null
        defaultQuantity: { type: MongooseSchema.Types.Mixed, required: false }, // Can be number or null
        defaultDiscount: { type: MongooseSchema.Types.Mixed, required: false }, // Can be number or null
        notes: { type: String, required: false },
        order: { type: Number, required: false },
        applyTemplateDiscount: { type: Boolean, required: false },
        applyTaxes: { type: Boolean, required: false },
        taxRate: { type: MongooseSchema.Types.Mixed, required: false }, // Can be number or null
      },
    ],
    default: [],
  })
  items: TemplateItem[];

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        fields: {
          type: [
            {
              key: { type: String, required: true },
              label: { type: String, required: true },
              inputType: { type: String, enum: ["text", "number"], required: true },
              defaultValue: { type: MongooseSchema.Types.Mixed, required: false }, // Can be string, number, or null
              order: { type: Number, required: false },
            },
          ],
          required: true,
        },
        hasPrice: { type: Boolean, required: true },
        hasQuantity: { type: Boolean, required: true },
        hasDiscount: { type: Boolean, required: true },
        defaultPrice: { type: MongooseSchema.Types.Mixed, required: false }, // Can be number or null
        defaultQuantity: { type: MongooseSchema.Types.Mixed, required: false }, // Can be number or null
        defaultDiscount: { type: MongooseSchema.Types.Mixed, required: false }, // Can be number or null
        applyTemplateDiscount: { type: Boolean, required: false },
        applyTaxes: { type: Boolean, required: false },
        taxRate: { type: MongooseSchema.Types.Mixed, required: false }, // Can be number or null
        order: { type: Number, required: false },
      },
    ],
    default: [],
  })
  equipmentItems: TemplateEquipmentItem[];

  @Prop({
    type: {
      currency: { type: String, required: true },
      templatePrice: { type: Number, required: false },
      templateDiscount: { type: Number, required: false },
      applyTemplateDiscount: { type: Boolean, required: false },
      templateTaxRate: { type: Number, required: false },
      applyTemplateTaxes: { type: Boolean, required: false },
    },
    required: true,
  })
  pricingConfig: TemplatePricingConfig;

  @Prop({ trim: true })
  notes?: string; // Notes/conditions block (e.g., "1000KGS: 1CBM", "Subject to ...", port charges, etc.). Client visibility controlled by showNotesToClient.

  @Prop({ type: Boolean, default: true })
  showAgentToClient: boolean;

  @Prop({ type: Boolean, default: true })
  showCarrierToClient: boolean;

  @Prop({ type: Boolean, default: true })
  showCommodityToClient: boolean;

  @Prop({ type: Boolean, default: true })
  showNotesToClient: boolean;

  @Prop({
    type: Types.ObjectId,
    ref: "Company",
    required: true,
  })
  companyId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: true,
  })
  createdBy: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: false,
  })
  updatedBy?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;
}

export const TemplateSchema = SchemaFactory.createForClass(Template);

// Create indexes
TemplateSchema.index({ name: 1 });
TemplateSchema.index({ companyId: 1 });
TemplateSchema.index({ category: 1 });
TemplateSchema.index({ serviceType: 1 });
TemplateSchema.index({ shippingModes: 1 });
TemplateSchema.index({ createdBy: 1 });
TemplateSchema.index({ updatedBy: 1 });
TemplateSchema.index({ isActive: 1 });
TemplateSchema.index({ createdAt: -1 });

