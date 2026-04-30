import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types, Schema as MongooseSchema } from "mongoose";

export type ShipmentDocument = HydratedDocument<Shipment>;

/**
 * Shipment status enum
 */
export enum ShipmentStatus {
  DRAFT = "DRAFT",
  READY_FOR_FINANCE = "READY_FOR_FINANCE",
  FINANCE_REVIEW = "FINANCE_REVIEW",
  APPROVED = "APPROVED",
  CLOSED = "CLOSED",
}

/**
 * Shipment mode enum
 */
export enum ShipmentMode {
  OCEAN = "OCEAN",
  AIR = "AIR",
  LAND = "LAND",
  MULTIMODAL = "MULTIMODAL",
}

/**
 * Container information for cargo
 */
export interface Container {
  containerNumber: string;
  sealNumber?: string;
  containerType?: string; // e.g., "20FT", "40FT", "40HC", etc.
  packages?: ContainerPackage[];
}

export interface PackageDimensions {
  length: number;
  width: number;
  height: number;
  unit?: string;
}

export interface ContainerPackage {
  type?: string;
  quantity?: number;
  dimensions: PackageDimensions;
}

/**
 * Party information (shipper, consignee, notify party)
 */
export interface Party {
  clientId?: Types.ObjectId; // Reference to clients collection
  name: string;
  address?: string;
  contact?: string;
  rtn?: string; // Tax ID / RTN
}

/**
 * Transport information for OCEAN mode
 */
export interface TransportOcean {
  vesselName?: string;
  voyageNumber?: string;
  portOfLoadingId?: Types.ObjectId; // Reference to ports collection
  portOfDischargeId?: Types.ObjectId; // Reference to ports collection
  placeOfReceipt?: string; // Free text
  placeOfDelivery?: string; // Free text
  loadingPierTerminal?: string;
  countryOfOriginGoods?: string;
  /** Inland / pre-carriage place (e.g. city of origin) */
  preCarriageBy?: string;
  /** Port of discharge (may differ from final place of delivery) */
  portOfDischarge?: string;
}

/**
 * Transport information for LAND mode
 */
export interface TransportLand {
  cartaPorteNumber?: string;
  manifestNumber?: string;
  documentDate?: Date;
  placeOfLoading?: string;
  placeOfUnloading?: string;
  driverName?: string;
  driverLicense?: string;
  truckPlate?: string;
  trailerPlate?: string;
  destinationCountry?: string;
  destinationWarehouse?: string;
  customsExit?: string;
  customsEntry?: string;
  exportInvoiceNumber?: string;
  freightPayment?: string;
}

/**
 * Transport information for AIR mode
 */
export interface TransportAir {
  hawbNumber?: string;
  airportOfDeparture?: string;
  airportOfDestination?: string;
  firstCarrier?: string;
  routing?: string[];
  requestedFlight?: string;
  requestedFlightDate?: Date;
  currency?: string;
  chargesCode?: string;
  declaredValueCarriage?: number;
  declaredValueCustoms?: number;
  insuranceAmount?: number;
  paymentTerm?: string;
}

/**
 * Transport information (union type based on mode)
 */
export interface Transport extends TransportOcean {
  land?: TransportLand;
  air?: TransportAir;
}

/**
 * Date information for shipment
 */
export interface ShipmentDates {
  etd?: Date; // Estimated Time of Departure
  eta?: Date; // Estimated Time of Arrival
  atd?: Date; // Actual Time of Departure
  ata?: Date; // Actual Time of Arrival
}

/**
 * Cargo information
 */
export interface Cargo {
  containers: Container[];
  /** Line-level packages at cargo root (e.g. air), same shape as container.packages */
  packages?: ContainerPackage[];
  packagesQuantity?: number;
  packagesType?: string; // e.g., "PALLETS", "CARTONS", "BAGS", etc.
  goodsDescription?: string;
  grossWeightKg?: number;
  netWeightKg?: number; // Net weight in kg
  volumeCbm?: number; // Volume in cubic meters
  airDimensionsText?: string; // Dimensions text for air cargo (e.g., "120x80x100 cm")
}

export interface ShipmentOperator {
  id: Types.ObjectId;
  email?: string;
  name?: string;
}

/**
 * Shipment Schema
 * Represents one complete shipment operation (maritime first), with workflow state and locking.
 * This is the "chisme" / operational shipment file.
 */
@Schema({ timestamps: true, collection: "shipments" })
export class Shipment {
  // =============================================================================
  // IDENTIFICATION / SCOPE
  // =============================================================================

  @Prop({
    type: Types.ObjectId,
    ref: "Company",
    required: true,
  })
  companyId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "Office",
    required: true,
  })
  officeId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "Quotation",
    required: false,
  })
  quotationId?: Types.ObjectId; // Reference to quotation (presiario)

  @Prop({
    type: String,
    enum: Object.values(ShipmentMode),
    required: true,
    default: ShipmentMode.OCEAN,
  })
  mode: ShipmentMode;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  incoterm: string; // e.g., "FOB", "CIF", "EXW", etc.

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  movementType?: string; // e.g., "FCL/FCL", "LCL/LCL", etc.

  // =============================================================================
  // PARTIES (snapshot-friendly)
  // =============================================================================

  @Prop({
    type: {
      shipper: {
        type: {
          clientId: { type: Types.ObjectId, ref: "Client", required: false },
          name: { type: String, required: true, trim: true },
          address: { type: String, required: false, trim: true },
          contact: { type: String, required: false, trim: true },
          rtn: { type: String, required: false, trim: true },
        },
        required: true,
        _id: false,
      },
      consignee: {
        type: {
          clientId: { type: Types.ObjectId, ref: "Client", required: false },
          name: { type: String, required: true, trim: true },
          address: { type: String, required: false, trim: true },
          contact: { type: String, required: false, trim: true },
          rtn: { type: String, required: false, trim: true },
        },
        required: true,
        _id: false,
      },
      notifyPartyText: { type: String, required: false, trim: true },
    },
    required: true,
    _id: false,
  })
  parties: {
    shipper: Party;
    consignee: Party;
    notifyPartyText?: string;
  };

  // =============================================================================
  // REFERENCES
  // =============================================================================

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  bookingNumber?: string;

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  mblNumber?: string; // Master Bill of Lading

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  hblNumber?: string; // House Bill of Lading (internal correlativo)

  @Prop({
    type: Types.ObjectId,
    ref: "Shipping",
    required: false,
  })
  shippingLineId?: Types.ObjectId; // Carrier / shipping line

  // =============================================================================
  // TRANSPORT
  // =============================================================================

  @Prop({
    type: {
      // Ocean fields
      vesselName: { type: String, required: false, trim: true },
      voyageNumber: { type: String, required: false, trim: true },
      portOfLoadingId: {
        type: Types.ObjectId,
        ref: "Port",
        required: false,
      },
      portOfDischargeId: {
        type: Types.ObjectId,
        ref: "Port",
        required: false,
      },
      placeOfReceipt: { type: String, required: false, trim: true },
      placeOfDelivery: { type: String, required: false, trim: true },
      loadingPierTerminal: { type: String, required: false, trim: true },
      countryOfOriginGoods: { type: String, required: false, trim: true },
      preCarriageBy: { type: String, required: false, trim: true },
      portOfDischarge: { type: String, required: false, trim: true },
      // Land fields
      land: {
        type: {
          cartaPorteNumber: { type: String, required: false, trim: true },
          manifestNumber: { type: String, required: false, trim: true },
          documentDate: { type: Date, required: false },
          placeOfLoading: { type: String, required: false, trim: true },
          placeOfUnloading: { type: String, required: false, trim: true },
          driverName: { type: String, required: false, trim: true },
          driverLicense: { type: String, required: false, trim: true },
          truckPlate: { type: String, required: false, trim: true },
          trailerPlate: { type: String, required: false, trim: true },
          destinationCountry: { type: String, required: false, trim: true },
          destinationWarehouse: { type: String, required: false, trim: true },
          customsExit: { type: String, required: false, trim: true },
          customsEntry: { type: String, required: false, trim: true },
          exportInvoiceNumber: { type: String, required: false, trim: true },
          freightPayment: { type: String, required: false, trim: true },
        },
        required: false,
        _id: false,
      },
      // Air fields
      air: {
        type: {
          hawbNumber: { type: String, required: false, trim: true },
          airportOfDeparture: { type: String, required: false, trim: true },
          airportOfDestination: { type: String, required: false, trim: true },
          firstCarrier: { type: String, required: false, trim: true },
          routing: { type: [String], default: [] },
          requestedFlight: { type: String, required: false, trim: true },
          requestedFlightDate: { type: Date, required: false },
          currency: { type: String, required: false, trim: true },
          chargesCode: { type: String, required: false, trim: true },
          declaredValueCarriage: { type: Number, required: false },
          declaredValueCustoms: { type: Number, required: false },
          insuranceAmount: { type: Number, required: false },
          paymentTerm: { type: String, required: false, trim: true },
        },
        required: false,
        _id: false,
      },
    },
    required: false,
    _id: false,
  })
  transport?: Transport;

  // =============================================================================
  // DATES
  // =============================================================================

  @Prop({
    type: {
      etd: { type: Date, required: false },
      eta: { type: Date, required: false },
      atd: { type: Date, required: false },
      ata: { type: Date, required: false },
    },
    required: false,
    _id: false,
  })
  dates?: ShipmentDates;

  // =============================================================================
  // CARGO
  // =============================================================================

  @Prop({
    type: {
      containers: {
        type: [
          {
            containerNumber: { type: String, required: true, trim: true },
            sealNumber: { type: String, required: false, trim: true },
            containerType: { type: String, required: false, trim: true },
            packages: {
              type: [
                {
                  type: { type: String, required: false, trim: true },
                  quantity: { type: Number, required: false },
                  dimensions: {
                    type: {
                      length: { type: Number, required: true },
                      width: { type: Number, required: true },
                      height: { type: Number, required: true },
                      unit: { type: String, required: false, trim: true },
                    },
                    required: true,
                    _id: false,
                  },
                },
              ],
              default: [],
              _id: false,
            },
          },
        ],
        default: [],
        _id: false,
      },
      packages: {
        type: [
          {
            type: { type: String, required: false, trim: true },
            quantity: { type: Number, required: false },
            dimensions: {
              type: {
                length: { type: Number, required: true },
                width: { type: Number, required: true },
                height: { type: Number, required: true },
                unit: { type: String, required: false, trim: true },
              },
              required: true,
              _id: false,
            },
          },
        ],
        default: [],
        _id: false,
      },
      packagesQuantity: { type: Number, required: false },
      packagesType: { type: String, required: false, trim: true },
      goodsDescription: { type: String, required: false, trim: true },
      grossWeightKg: { type: Number, required: false },
      netWeightKg: { type: Number, required: false },
      volumeCbm: { type: Number, required: false },
      airDimensionsText: { type: String, required: false, trim: true },
    },
    required: true,
    _id: false,
  })
  cargo: Cargo;

  // =============================================================================
  // CONTROL / WORKFLOW
  // =============================================================================

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: true,
  })
  operationalUserId: Types.ObjectId; // User responsible for operations

  @Prop({
    type: {
      id: { type: Types.ObjectId, ref: "User", required: true },
      email: { type: String, required: false, trim: true },
      name: { type: String, required: false, trim: true },
    },
    required: false,
    _id: false,
  })
  operator?: ShipmentOperator;

  @Prop({
    type: String,
    enum: Object.values(ShipmentStatus),
    required: true,
    default: ShipmentStatus.DRAFT,
  })
  status: ShipmentStatus;

  @Prop({
    type: Date,
    required: false,
  })
  lockedAt?: Date;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: false,
  })
  lockedBy?: Types.ObjectId;

  @Prop({
    type: String,
    required: false,
    trim: true,
    maxlength: 5000,
  })
  financeLastNote?: string;

  // =============================================================================
  // AUDIT (handled by timestamps: true)
  // =============================================================================
  // createdAt and updatedAt are automatically added by timestamps: true

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

  // =============================================================================
  // QUOTATION SNAPSHOT
  // =============================================================================

  @Prop({
    type: {
      quotationId: { type: Types.ObjectId, ref: "Quotation", required: true },
      serviceType: { type: String, required: false, trim: true },
      incoterm: { type: String, required: false, trim: true },
      shippingMode: {
        type: String,
        enum: ["maritime", "air", "road"],
        required: false,
      },
      clientId: { type: Types.ObjectId, ref: "Client", required: false },
      agentId: { type: Types.ObjectId, ref: "Agent", required: false },
      shippingLineId: { type: Types.ObjectId, ref: "Shipping", required: false },
      portOfOrigin: { type: Types.ObjectId, ref: "Port", required: false },
      portOfDestination: { type: Types.ObjectId, ref: "Port", required: false },
      currency: { type: String, required: false, trim: true },
      templateId: { type: Types.ObjectId, ref: "Template", required: false },
      items: {
        type: [
          {
            itemId: { type: String, required: true },
            description: { type: String, required: false },
            price: { type: MongooseSchema.Types.Mixed, required: false },
            quantity: { type: MongooseSchema.Types.Mixed, required: false },
            discount: { type: MongooseSchema.Types.Mixed, required: false },
            applyTaxes: { type: Boolean, required: false },
            taxRate: { type: MongooseSchema.Types.Mixed, required: false },
            notes: { type: String, required: false },
            type: { type: String, required: false, trim: true },
          },
        ],
        default: [],
        _id: false,
      },
      equipmentItems: {
        type: [
          {
            equipmentItemId: { type: String, required: true },
            label: { type: String, required: false },
            quantity: { type: MongooseSchema.Types.Mixed, required: false },
            price: { type: MongooseSchema.Types.Mixed, required: false },
            discount: { type: MongooseSchema.Types.Mixed, required: false },
            applyTaxes: { type: Boolean, required: false },
            taxRate: { type: MongooseSchema.Types.Mixed, required: false },
            notes: { type: String, required: false },
            type: { type: String, required: false, trim: true },
          },
        ],
        default: [],
        _id: false,
      },
      total: { type: Number, required: false },
      validUntil: { type: Date, required: false },
      snapshotTakenAt: { type: Date, required: true },
      snapshotTakenBy: {
        type: Types.ObjectId,
        ref: "User",
        required: true,
      },
    },
    required: false,
    _id: false,
  })
  quotationSnapshot?: {
    quotationId: Types.ObjectId;
    serviceType?: string;
    incoterm?: string;
    shippingMode?: "maritime" | "air" | "road";
    clientId?: Types.ObjectId;
    agentId?: Types.ObjectId;
    shippingLineId?: Types.ObjectId;
    portOfOrigin?: Types.ObjectId;
    portOfDestination?: Types.ObjectId;
    currency?: string;
    templateId?: Types.ObjectId;
    items?: Array<{
      itemId: string;
      description?: string;
      price?: number | null;
      quantity?: number | null;
      discount?: number | null;
      applyTaxes?: boolean;
      taxRate?: number | null;
      notes?: string;
      type?: string;
    }>;
    equipmentItems?: Array<{
      equipmentItemId: string;
      label?: string;
      quantity?: number | null;
      price?: number | null;
      discount?: number | null;
      applyTaxes?: boolean;
      taxRate?: number | null;
      notes?: string;
      type?: string;
    }>;
    total?: number;
    validUntil?: Date;
    snapshotTakenAt: Date;
    snapshotTakenBy: Types.ObjectId;
  };
}

export const ShipmentSchema = SchemaFactory.createForClass(Shipment);

// Create indexes for efficient queries
ShipmentSchema.index({ companyId: 1, createdAt: -1 });
ShipmentSchema.index({ officeId: 1, createdAt: -1 });
ShipmentSchema.index({ quotationId: 1 });
ShipmentSchema.index({ status: 1, createdAt: -1 });
ShipmentSchema.index({ operationalUserId: 1, status: 1 });
ShipmentSchema.index({ "operator.id": 1 });
ShipmentSchema.index({ bookingNumber: 1 });
ShipmentSchema.index({ mblNumber: 1 });
ShipmentSchema.index({ hblNumber: 1 });
ShipmentSchema.index({ shippingLineId: 1 });
ShipmentSchema.index({ "parties.shipper.clientId": 1 }, { sparse: true });
ShipmentSchema.index({ "parties.consignee.clientId": 1 }, { sparse: true });
ShipmentSchema.index({ "transport.portOfLoadingId": 1 });
ShipmentSchema.index({ "transport.portOfDischargeId": 1 });
ShipmentSchema.index({ lockedBy: 1 });
ShipmentSchema.index({ createdAt: -1 });