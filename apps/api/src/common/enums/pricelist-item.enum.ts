/**
 * Enums for PricelistItem fields
 */

export enum ChargeType {
  OCEAN_FREIGHT = "OCEAN_FREIGHT",
  DESTINATION_CHARGE = "DESTINATION_CHARGE",
  DOC_FEE = "DOC_FEE",
  OTHER = "OTHER",
}

export const CHARGE_TYPES = Object.values(ChargeType);

export enum EquipmentType {
  "20GP" = "20GP",
  "40GP" = "40GP",
  "40HC" = "40HC",
  "40HQ" = "40HQ",
  LCL = "LCL",
}

export const EQUIPMENT_TYPES = Object.values(EquipmentType);

export enum PricingUnit {
  PER_CONTAINER = "PER_CONTAINER",
  PER_BL = "PER_BL",
  PER_SHIPMENT = "PER_SHIPMENT",
  PER_KG = "PER_KG",
  FLAT = "FLAT",
}

export const PRICING_UNITS = Object.values(PricingUnit);
