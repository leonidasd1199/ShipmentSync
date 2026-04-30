import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types, Schema as MongooseSchema } from "mongoose";

export type QuotationDocument = HydratedDocument<Quotation>;

// Quotation header field value (filled in by user based on template headerFields)
export interface QuotationHeaderFieldValue {
  fieldId: string; // References template headerField.id
  value: any; // The actual value filled in by user
}

// Quotation item value (filled in by user based on template items, or pricelist items)
export interface QuotationItemValue {
  itemId?: string; // References template item.id (optional for pricelist items)
  description?: string; // Item description
  price?: number | null; // Actual price value (selling price)
  cost?: number | null; // Raw cost before profit
  quantity?: number | null; // Actual quantity value
  discount?: number | null; // Actual discount value
  profit?: number | null; // Profit margin/value for this item
  notes?: string; // Item-specific notes
  applyTemplateDiscount?: boolean; // Whether to apply template discount
  applyTaxes?: boolean; // Whether to apply taxes
  taxRate?: number | null; // Tax rate percentage
  type?: string; // Item type (cargo, custom)
  transitType?: string; // Transit type (air, land, maritime)
  equipmentType?: string; // Container/equipment type
}

// Quotation equipment item value (filled in by user based on template equipmentItems)
export interface QuotationEquipmentItemValue {
  equipmentItemId: string; // References template equipmentItem.id
  label?: string; // Equipment label
  quantity?: number | null; // Actual quantity value
  price?: number | null; // Actual price value
  discount?: number | null; // Actual discount value
  fieldValues?: Array<{
    fieldKey: string; // References template equipmentItem.field.key
    value: any; // Actual field value
  }>;
  notes?: string; // Equipment-specific notes
  applyTemplateDiscount?: boolean; // Whether to apply template discount
  applyTaxes?: boolean; // Whether to apply taxes
  taxRate?: number | null; // Tax rate percentage
}

// Quotation pricing configuration (copied from template, can be overridden)
export interface QuotationPricingConfig {
  currency: string;
  templatePrice?: number | null;
  templateDiscount?: number | null;
  applyTemplateDiscount?: boolean;
  templateTaxRate?: number | null;
  applyTemplateTaxes?: boolean;
}

@Schema({ timestamps: true, collection: "quotations" })
export class Quotation {
  @Prop({
    type: String,
    required: false,
    unique: true,
    sparse: true,
  })
  quoteNumber?: string; // e.g. "QT-2026-0001"

  @Prop({
    type: String,
    required: false,
  })
  serviceType?: string;

  @Prop({
    type: String,
    required: false,
  })
  incoterm?: string;

  @Prop({
    type: String,
    enum: ["maritime", "air", "road"],
    required: false,
  })
  shippingMode?: "maritime" | "air" | "road";

  @Prop({
    type: Types.ObjectId,
    ref: "Template",
    required: false,
  })
  templateId?: Types.ObjectId; // Reference to template used (optional for backward compatibility)

  @Prop({
    type: Types.ObjectId,
    ref: "Client",
    required: true,
  })
  clientId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "Company",
    required: true,
  })
  companyId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "Shipping",
    required: true,
  })
  shippingLineId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "Agent",
    required: false,
  })
  agentId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "Port",
    required: false,
  })
  portOfOrigin?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "Port",
    required: false,
  })
  portOfDestination?: Types.ObjectId;

  // Header field values (filled in by user based on template headerFields)
  @Prop({
    type: [
      {
        fieldId: { type: String, required: true },
        value: { type: MongooseSchema.Types.Mixed, required: false },
      },
    ],
    default: [],
  })
  headerFieldValues?: QuotationHeaderFieldValue[];

  // Items (template-based or pricelist-based)
  @Prop({
    type: [
      {
        itemId: { type: String, required: false },
        description: { type: String, required: false },
        price: { type: MongooseSchema.Types.Mixed, required: false },
        cost: { type: MongooseSchema.Types.Mixed, required: false },
        quantity: { type: MongooseSchema.Types.Mixed, required: false },
        discount: { type: MongooseSchema.Types.Mixed, required: false },
        profit: { type: MongooseSchema.Types.Mixed, required: false },
        notes: { type: String, required: false },
        applyTemplateDiscount: {
          type: Boolean,
          required: false,
          default: false,
        },
        applyTaxes: { type: Boolean, required: false, default: false },
        taxRate: { type: MongooseSchema.Types.Mixed, required: false },
        type: { type: String, required: false },
        transitType: { type: String, required: false },
        equipmentType: { type: String, required: false },
      },
    ],
    default: [],
  })
  items?: QuotationItemValue[];

  // Equipment items with actual values
  @Prop({
    type: [
      {
        equipmentItemId: { type: String, required: true },
        label: { type: String, required: false },
        quantity: { type: MongooseSchema.Types.Mixed, required: false },
        price: { type: MongooseSchema.Types.Mixed, required: false },
        discount: { type: MongooseSchema.Types.Mixed, required: false },
        fieldValues: {
          type: [
            {
              fieldKey: { type: String, required: true },
              value: { type: MongooseSchema.Types.Mixed, required: false },
            },
          ],
          required: false,
        },
        notes: { type: String, required: false },
        applyTaxes: { type: Boolean, required: false, default: false },
        taxRate: { type: MongooseSchema.Types.Mixed, required: false },
        applyTemplateDiscount: { type: Boolean, required: false },
      },
    ],
    default: [],
  })
  equipmentItems?: QuotationEquipmentItemValue[];

  // Pricing configuration (copied from template, can be overridden)
  @Prop({
    type: {
      currency: { type: String, required: true },
      templatePrice: { type: Number, required: false },
      templateDiscount: { type: Number, required: false },
      applyTemplateDiscount: { type: Boolean, required: false },
      templateTaxRate: { type: Number, required: false },
      applyTemplateTaxes: { type: Boolean, required: false },
    },
    required: false,
  })
  pricingConfig?: QuotationPricingConfig;

  // Legacy items (for backward compatibility)
  @Prop({
    type: [
      {
        type: {
          type: String,
          enum: ["cargo", "custom"],
          required: true,
        },
        description: { type: String, required: true },
        price: { type: Number, required: true },
        cost: { type: Number, required: false }, // raw cost before profit
        quantity: { type: Number, required: false, default: 1 },
        discount: { type: Number, required: false, default: 0 },
        applyDiscount: { type: Boolean, required: false, default: true },
        applyTaxes: { type: Boolean, required: false, default: false },
        taxRate: { type: Number, required: false, default: 0 },
        notes: { type: String, required: false },
        transitType: {
          type: String,
          enum: ["air", "land", "maritime"],
          required: false,
        },
        equipmentType: { type: String, required: false },
      },
    ],
    required: false,
    default: [],
  })
  legacyItems?: {
    type: "cargo" | "custom";
    description: string;
    price: number;
    cost?: number;
    quantity?: number;
    discount?: number;
    applyDiscount?: boolean;
    applyTaxes?: boolean;
    taxRate?: number;
    notes?: string;
    transitType?: "air" | "land" | "maritime";
    equipmentType?: string;
  }[];

  @Prop({ type: String, required: false })
  sourcePricelistId?: string; // tracks which pricelist this quotation was created from

  @Prop({ type: Number })
  total?: number;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: true,
  })
  createdBy: Types.ObjectId;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: Date, required: true })
  validUntil: Date;

  @Prop({ type: Boolean, default: false })
  summarize: boolean;

  // Visibility flags (copied from template)
  @Prop({ type: Boolean, default: true })
  showAgentToClient: boolean;

  @Prop({ type: Boolean, default: true })
  showCarrierToClient: boolean;

  @Prop({ type: Boolean, default: true })
  showCommodityToClient: boolean;

  @Prop({ type: Boolean, default: true })
  showNotesToClient: boolean;

  @Prop({
    type: String,
    enum: ["draft", "sent", "accepted", "rejected", "expired"],
    default: "draft",
  })
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export const QuotationSchema = SchemaFactory.createForClass(Quotation);

// Create indexes
QuotationSchema.index({ quoteNumber: 1 }, { unique: true, sparse: true });
QuotationSchema.index({ serviceType: 1 });
QuotationSchema.index({ incoterm: 1 });
QuotationSchema.index({ shippingMode: 1 });
QuotationSchema.index({ templateId: 1 });
QuotationSchema.index({ clientId: 1 });
QuotationSchema.index({ companyId: 1 });
QuotationSchema.index({ shippingLineId: 1 });
QuotationSchema.index({ agentId: 1 });
QuotationSchema.index({ portOfOrigin: 1 });
QuotationSchema.index({ portOfDestination: 1 });
QuotationSchema.index({ createdBy: 1 });
QuotationSchema.index({ validUntil: 1 });
QuotationSchema.index({ status: 1 });
QuotationSchema.index({ isActive: 1 });
QuotationSchema.index({ createdAt: -1 });
QuotationSchema.index({ clientId: 1, companyId: 1 });
