/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { TransitTypeEnum, QuotationStatusEnum, SortOrderEnum } from "../constants";
import type { Agent } from "./agent.type";
import type { Client } from "./client.type";
import type { Company } from "./company.type";
import type { ShippingLine } from "./shipping.type";

// ============================================================================
// HEADER FIELD VALUES
// ============================================================================

export interface QuotationHeaderFieldValueDto {
  fieldId: string;
  value?: string | number | boolean | null;
}

// ============================================================================
// TEMPLATE-BASED ITEMS (items array)
// ============================================================================

export interface QuotationItemValueDto {
  itemId: string;
  description?: string;
  price?: number | null;
  quantity?: number | null;
  discount?: number | null;
  notes?: string;
  applyTemplateDiscount?: boolean;
  applyTaxes?: boolean;
  taxRate?: number | null;
}

// ============================================================================
// EQUIPMENT ITEMS
// ============================================================================

export interface QuotationEquipmentFieldValueDto {
  fieldKey: string;
  value?: string | number | boolean | null;
}

export interface QuotationEquipmentItemValueDto {
  equipmentItemId: string;
  label?: string;
  fieldValues?: QuotationEquipmentFieldValueDto[];
  price?: number | null;
  quantity?: number | null;
  discount?: number | null;
  applyTemplateDiscount?: boolean;
  applyTaxes?: boolean;
  taxRate?: number | null;
}

// ============================================================================
// LEGACY ITEMS (legacyItems array - for non-template quotations)
// ============================================================================

export interface QuotationLegacyItemDto {
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
}

// ============================================================================
// PRICING CONFIG
// ============================================================================

export interface QuotationPricingConfigDto {
  currency: string;
  templatePrice?: number | null;
  templateDiscount?: number | null;
  applyTemplateDiscount?: boolean;
  templateTaxRate?: number | null;
  applyTemplateTaxes?: boolean;
}

// ============================================================================
// CREATE / UPDATE DTOs
// ============================================================================

export interface CreateQuotationDto {
  // Required fields
  clientId: string;
  companyId: string;
  shippingLineId: string;
  validUntil: string | Date;

  // Optional reference fields
  agentId?: string;
  templateId?: string;
  originPortId?: string;
  destinationPortId?: string;

  // Service configuration
  serviceType?: string;
  incoterm?: string;
  shippingMode?: "maritime" | "air" | "road";

  // Template-based items (used when templateId is present)
  items?: QuotationItemValueDto[];

  // Legacy items (used when templateId is NOT present)
  legacyItems?: QuotationLegacyItemDto[];

  // Header field values (from template)
  headerFieldValues?: QuotationHeaderFieldValueDto[];

  // Equipment items (from template)
  equipmentItems?: QuotationEquipmentItemValueDto[];

  // Pricing configuration
  pricingConfig?: QuotationPricingConfigDto;

  // Options
  notes?: string;
  summarize?: boolean;
  status?: QuotationStatusEnum;

  // Visibility settings
  showAgentToClient?: boolean;
  showCarrierToClient?: boolean;
  showCommodityToClient?: boolean;
  showNotesToClient?: boolean;

  sourcePricelistId?: string;
}

export interface UpdateQuotationDto extends Partial<CreateQuotationDto> {
  status?: QuotationStatusEnum;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface QuotationItemResponse {
  itemId?: string;
  type?: "cargo" | "custom";
  description?: string;
  price?: number | null;
  quantity?: number | null;
  discount?: number | null;
  notes?: string;
  transitType?: TransitTypeEnum;
  applyTemplateDiscount?: boolean;
  applyTaxes?: boolean;
  taxRate?: number | null;
}

export interface QuotationResponse {
  id: string;
  quoteNumber?: string;

  // Service configuration
  serviceType?: string;
  incoterm?: string;
  shippingMode?: "maritime" | "air" | "road";

  // References
  clientId: string;
  companyId: string;
  shippingLineId: string;
  agentId?: string;
  templateId?: string;
  portOfOrigin?: string;
  portOfDestination?: string;

  // Populated references
  client?: Partial<Client>;
  company?: Company;
  shippingLine?: Partial<ShippingLine>;
  agent?: Partial<Agent>;
  template?: {
    id: string;
    name: string;
    serviceType?: string;
    category?: string;
  };
  portOfOriginData?: {
    id: string;
    name: string;
    unlocode?: string;
    countryCode?: string;
    countryName?: string;
    city?: string;
    type?: string;
  };
  portOfDestinationData?: {
    id: string;
    name: string;
    unlocode?: string;
    countryCode?: string;
    countryName?: string;
    city?: string;
    type?: string;
  };

  // Items
  items?: QuotationItemResponse[];
  legacyItems?: QuotationLegacyItemDto[];
  headerFieldValues?: QuotationHeaderFieldValueDto[];
  equipmentItems?: QuotationEquipmentItemValueDto[];

  // Pricing
  pricingConfig?: QuotationPricingConfigDto;

  // Details
  notes?: string;
  validUntil: string | Date;
  summarize: boolean;
  total?: number;
  status: QuotationStatusEnum;

  // Visibility
  showAgentToClient?: boolean;
  showCarrierToClient?: boolean;
  showCommodityToClient?: boolean;
  showNotesToClient?: boolean;

  sourcePricelistId?: string;

  // Metadata
  createdBy?: string;
  creator?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface QuotationFilters {
  clientId?: string;
  createdBy?: string;
  agentId?: string;
  chargeType?: TransitTypeEnum;
  shippingLineId?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: SortOrderEnum;
  sourcePricelistId?: string;
  status?: "draft" | "sent" | "accepted" | "rejected" | "expired";
}

export interface QuotationListItemResponse extends QuotationResponse {}

export interface QuotationListResponse {
  items: QuotationListItemResponse[];
  page: number;
  limit: number;
  total: number;
}