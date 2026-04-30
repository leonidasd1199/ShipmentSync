import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types, Schema as MongooseSchema } from "mongoose";
import {
  MaritimeIncoterm,
  MARITIME_INCOTERMS,
  Currency,
  CURRENCIES,
} from "../common/enums/maritime-incoterms.enum";
import {
  ChargeType,
  CHARGE_TYPES,
  EquipmentType,
  EQUIPMENT_TYPES,
  PricingUnit,
  PRICING_UNITS,
} from "../common/enums/pricelist-item.enum";

export type AgentPricelistDocument = HydratedDocument<AgentPricelist>;

// Pricelist status enum
export enum PricelistStatus {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  APPROVED = "approved",
  REJECTED = "rejected",
  SUPERSEDED = "superseded",
}

// Lane subdocument interface
export interface PricelistItemLane {
  originPortCode?: string;
  destinationPortCode?: string;
  originName?: string;
  destinationName?: string;
}

// PricelistItem subdocument schema
export interface PricelistItem {
  _id?: Types.ObjectId;
  name: string;
  chargeType: ChargeType;
  incoterm: MaritimeIncoterm; // Maritime incoterms only
  equipmentType?: EquipmentType;
  lane?: PricelistItemLane;
  cost: number; // >= 0
  profit?: number; // >= 0, profit/markup per unit on top of cost
  currency: Currency;
  pricingUnit?: PricingUnit;
  validFrom?: Date;
  validTo?: Date;
  freeTimeDays?: number;
  transitTimeDaysMin?: number;
  transitTimeDaysMax?: number;
  carrierName?: string;
  metadata?: any; // Mixed optional
}

@Schema({ timestamps: true, collection: "agent_pricelists" })
export class AgentPricelist {
  @Prop({
    type: Types.ObjectId,
    ref: "Agent",
    required: true,
  })
  agentId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "Shipping",
    required: true,
  })
  supplierId: Types.ObjectId;

  // Weekly identity (CRITICAL)
  // weekStart is always calculated automatically (Monday 00:00:00 of current week)
  @Prop({
    type: Date,
    required: true, // Required - always calculated in service
    index: true,
  })
  weekStart: Date; // Monday 00:00:00 in business timezone

  @Prop({
    type: Date,
    required: false,
  })
  weekEnd?: Date; // Optional, can be computed

  // Status + lifecycle (CRITICAL)
  @Prop({
    type: String,
    enum: Object.values(PricelistStatus),
    default: PricelistStatus.DRAFT,
    required: true,
    index: true,
  })
  status: PricelistStatus;

  @Prop({
    type: Date,
    required: false,
  })
  submittedAt?: Date;

  @Prop({
    type: Date,
    required: false,
  })
  approvedAt?: Date;

  @Prop({
    type: Date,
    required: false,
  })
  rejectedAt?: Date;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: false,
  })
  approvedBy?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: false,
  })
  rejectedBy?: Types.ObjectId;

  @Prop({
    type: String,
    required: false,
  })
  rejectionReason?: string;

  // Items array
  @Prop({
    type: [
      {
        name: { type: String, required: true, trim: true },
        chargeType: {
          type: String,
          enum: CHARGE_TYPES,
          required: true,
        },
        incoterm: {
          type: String,
          enum: MARITIME_INCOTERMS,
          required: true,
        },
        equipmentType: {
          type: String,
          enum: EQUIPMENT_TYPES,
          required: false,
        },
        lane: {
          originPortCode: { type: String, required: false },
          destinationPortCode: { type: String, required: false },
          originName: { type: String, required: false },
          destinationName: { type: String, required: false },
        },
        cost: {
          type: Number,
          required: true,
          min: [0, "Cost must be >= 0"],
        },
        profit: {
          type: Number,
          required: false,
          min: [0, "Profit must be >= 0"],
          default: 0,
        },
        currency: {
          type: String,
          enum: CURRENCIES,
          required: true,
        },
        pricingUnit: {
          type: String,
          enum: PRICING_UNITS,
          required: false,
        },
        validFrom: { type: Date, required: false },
        validTo: { type: Date, required: false },
        freeTimeDays: { type: Number, required: false, min: 0 },
        transitTimeDaysMin: { type: Number, required: false, min: 0 },
        transitTimeDaysMax: { type: Number, required: false, min: 0 },
        carrierName: { type: String, required: false },
        metadata: { type: MongooseSchema.Types.Mixed, required: false },
      },
    ],
    default: [],
  })
  items: PricelistItem[];

  // Performance helpers (CRITICAL)
  @Prop({
    type: Number,
    default: 0,
    required: true,
  })
  totalCost: number; // Sum of items cost

  @Prop({
    type: Number,
    default: 0,
    required: true,
  })
  itemCount: number; // Count of items

  // Auto-generated timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export const AgentPricelistSchema =
  SchemaFactory.createForClass(AgentPricelist);

// Pre-save hook to compute totalCost and itemCount
AgentPricelistSchema.pre("save", function (next) {
  if (this.items && Array.isArray(this.items)) {
    this.itemCount = this.items.length;
    this.totalCost = this.items.reduce(
      (sum, item) => sum + (item.cost || 0),
      0,
    );
  } else {
    this.itemCount = 0;
    this.totalCost = 0;
  }
  next();
});

// Indexes
// 1. Partial unique index: prevent duplicate active pricelists in same week
// This ensures no two active pricelists exist for the same agent+supplier+week
AgentPricelistSchema.index(
  { agentId: 1, supplierId: 1, weekStart: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [
          PricelistStatus.DRAFT,
          PricelistStatus.SUBMITTED,
          PricelistStatus.APPROVED,
        ],
      },
    },
  },
);

// 2. Performance indexes
AgentPricelistSchema.index({ agentId: 1 });
AgentPricelistSchema.index({ supplierId: 1 });
AgentPricelistSchema.index({ weekStart: -1 }); // For sorting by week
AgentPricelistSchema.index({ status: 1 }); // For filtering by status
AgentPricelistSchema.index({ createdAt: -1 });
AgentPricelistSchema.index({ agentId: 1, status: 1 }); // For operator "pending approval" queries