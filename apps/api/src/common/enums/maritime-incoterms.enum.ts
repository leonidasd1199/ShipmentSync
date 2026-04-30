/**
 * Maritime-specific Incoterms (ICC 2020)
 * These are the incoterms commonly used for maritime shipping
 */
export enum MaritimeIncoterm {
  EXW = "EXW", // Ex Works
  FCA = "FCA", // Free Carrier
  FAS = "FAS", // Free Alongside Ship
  FOB = "FOB", // Free On Board
  CFR = "CFR", // Cost and Freight
  CIF = "CIF", // Cost, Insurance and Freight
  CPT = "CPT", // Carriage Paid To
  CIP = "CIP", // Carriage and Insurance Paid To
  DAP = "DAP", // Delivered At Place
  DPU = "DPU", // Delivered at Place Unloaded
  DDP = "DDP", // Delivered Duty Paid
}

/**
 * Array of maritime incoterm values for validation
 */
export const MARITIME_INCOTERMS = Object.values(MaritimeIncoterm);

/**
 * Currency codes supported in the system
 */
export enum Currency {
  USD = "USD", // US Dollar
  EUR = "EUR", // Euro
  GBP = "GBP", // British Pound
  MXN = "MXN", // Mexican Peso
  CAD = "CAD", // Canadian Dollar
  JPY = "JPY", // Japanese Yen
  CNY = "CNY", // Chinese Yuan
  BRL = "BRL", // Brazilian Real
  ARS = "ARS", // Argentine Peso
  CLP = "CLP", // Chilean Peso
  COP = "COP", // Colombian Peso
  PEN = "PEN", // Peruvian Sol
  HNL = "HNL", // Lempiras
}

/**
 * Array of currency values for validation
 */
export const CURRENCIES = Object.values(Currency);
