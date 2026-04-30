export enum TransitTypeEnum {
    Air = "air",
    Land = "land",
    Maritime = "maritime",
}

export enum QuotationStatusEnum {
    Draft = "draft",
    Sent = "sent",
    Accepted = "accepted",
    Rejected = "rejected",
    Expired = "expired",
}

// DEPRECATED: Use "cargo" | "custom" string literals instead
// export enum ChargeQuotationTypeEnum {
//     charge = "charge",
//     custom = "custom"
// }

export enum SortOrderEnum {
    ASC = "ASC",
    DESC = "DESC",
}

export enum ShippingModeEnum {
  MARITIME = "maritime",
  AIR = "air",
  ROAD = "road",
}
export enum ShipmentStatusEnum {
  DRAFT = "DRAFT",
  READY_FOR_FINANCE = "READY_FOR_FINANCE",
  FINANCE_REVIEW = "FINANCE_REVIEW",
  APPROVED = "APPROVED",
  CLOSED = "CLOSED",
}

export enum ShipmentModeEnum {
  OCEAN = "OCEAN",
  AIR = "AIR",
  LAND = "LAND",
  MULTIMODAL = "MULTIMODAL",
}
