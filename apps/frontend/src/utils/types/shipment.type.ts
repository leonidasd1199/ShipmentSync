export type ShipmentStatusType =
  | "DRAFT"
  | "READY_FOR_FINANCE"
  | "FINANCE_REVIEW"
  | "APPROVED"
  | "CLOSED";

export type ShipmentModeType = "OCEAN" | "AIR" | "LAND" | "MULTIMODAL";

export type ContainerPackageDimensions = {
  length: number;
  width: number;
  height: number;
  unit?: "cm" | "in" | "m";
};

export type ContainerPackage = {
  type?: string;
  quantity?: number;
  dimensions: ContainerPackageDimensions;
};

export type Container = {
  containerNumber?: string;
  sealNumber?: string;
  containerType?: string;
  packages?: ContainerPackage[];
};

export type Party = {
  clientId?: string;
  name: string;
  address?: string;
  contact?: string;
  rtn?: string;
};

export type TransportAir = {
  hawbNumber?: string;
  airportOfDeparture?: string;
  airportOfDestination?: string;
};

export type TransportLand = {
  cartaPorteNumber?: string;
  placeOfLoading?: string;
  placeOfUnloading?: string;
  driver?: string;
  plaque?: string;
  license?: string;
  /** Persisted by API / used in document templates */
  driverName?: string;
  truckPlate?: string;
  driverLicense?: string;
};

export type ShipmentTransport = {
  vesselName?: string;
  voyageNumber?: string;
  portOfLoadingId?: string;
  portOfDischargeId?: string;
  placeOfReceipt?: string;
  placeOfDelivery?: string;
  air?: TransportAir;
  land?: TransportLand;
};

export type ShipmentDates = {
  etd?: string;
  eta?: string;
  atd?: string;
  ata?: string;
};

export type Cargo = {
  containers: Container[];
  /** Cargo-level line items (e.g. air packages with dimensions), distinct from packages inside containers */
  packages?: ContainerPackage[];
  packagesQuantity?: number;
  packagesType?: string;
  goodsDescription?: string;
  grossWeightKg?: number;
  volumeCbm?: number;
  airDimensionsText?: string;
};

export type QuotationSnapshot = {
  quotationId: string;
  serviceType?: string;
  incoterm?: string;
  shippingMode?: string;
  clientId?: string;
  agentId?: string;
  shippingLineId?: string;
  portOfOrigin?: string;
  portOfDestination?: string;
  currency?: string;
  templateId?: string;
  items?: Array<{
    itemId: string;
    description?: string;
    price?: number | null;
    profit?: number | null;
    quantity?: number | null;
  }>;
  equipmentItems?: Array<{
    equipmentItemId: string;
    label?: string;
    price?: number | null;
    quantity?: number | null;
  }>;
  total?: number;
  validUntil?: string;
};

export type LedgerLineDocument = {
  _id: string;
  shipmentId: string;
  ledgerLineId: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt?: string;
  isActive?: boolean;
  note?: string;
};

export type LedgerLine = {
  _id: string;
  shipmentId: string;
  supplierId?: string;
  supplier?: {
    id: string;
    name?: string;
  };
  side: "DEBIT" | "CREDIT";
  description: string;
  amount: number;
  currency: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  source: "MANUAL" | "QUOTATION_ITEM";
  createdAt?: string;
  /** From GET …/ledgerLines — active supporting documents count */
  documentsCount?: number;
  hasDocuments?: boolean;
};

export type ShipmentUserRef = {
  _id?: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
};

export type Shipment = {
  _id: string;
  id?: string;
  companyId: string;
  officeId: string;
  quotationId?: string;
  mode: ShipmentModeType;
  incoterm: string;
  movementType?: string;
  parties: {
    shipper: Party;
    consignee: Party;
    notifyPartyText?: string;
  };
  bookingNumber?: string;
  mblNumber?: string;
  hblNumber?: string;
  shippingLineId?: string;
  transport?: ShipmentTransport;
  dates?: ShipmentDates;
  cargo: Cargo;
  operationalUserId: string;
  status: ShipmentStatusType;
  financeLastNote?: string;
  quotationSnapshot?: QuotationSnapshot;
  createdBy?: string | ShipmentUserRef;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateShipmentDto = {
  companyId: string;
  officeId: string;
  quotationId?: string;
  quotationSnapshot?: QuotationSnapshot;
  mode: ShipmentModeType;
  incoterm: string;
  movementType?: string;
  parties: {
    shipper: Party;
    consignee: Party;
    notifyPartyText?: string;
  };
  bookingNumber?: string;
  mblNumber?: string;
  hblNumber?: string;
  shippingLineId?: string;
  transport?: ShipmentTransport;
  dates?: ShipmentDates;
  cargo: Cargo;
  operationalUserId: string;
};

export type UpdateShipmentDto = Partial<CreateShipmentDto>;

export type ShipmentFilters = {
  status?: string;
  mode?: string;
  incoterm?: string;
  search?: string;
  officeId?: string;
  companyId?: string;
};

export type ShipmentDocItem = {
  _id: string;
  documentType: string;
  version: number;
  status: "GENERATED" | "LOCKED" | "FAILED";
  generatedAt: string;
  fileSize?: number;
  lockedAt?: string;
  lockedBy?: string;
  downloadUrl: string;
};

/** Shipment + ledger line pair for finance dashboards (debits or credits). */
export type ShipmentLedgerRow = {
  shipment: Shipment;
  line: LedgerLine;
};

/** @deprecated Use ShipmentLedgerRow */
export type ShipmentDebitRow = ShipmentLedgerRow;
