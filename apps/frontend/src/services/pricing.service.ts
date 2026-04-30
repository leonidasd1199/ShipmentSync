import http from "../utils/agent-http";

// =============================================================================
// TYPES
// =============================================================================

export interface Lane {
  originPortCode?: string;
  originName?: string;
  destinationPortCode?: string;
  destinationName?: string;
}

export interface PricelistItemDto {
  name: string;
  chargeType: "OCEAN_FREIGHT" | "DESTINATION_CHARGE" | "DOC_FEE" | "OTHER";
  incoterm: string;
  equipmentType?: "20GP" | "40GP" | "40HC" | "40HQ" | "45HC" | "LCL";
  lane?: Lane;
  cost: number;
  profit?: number;
  currency: string;
  pricingUnit?: "PER_CONTAINER" | "PER_SHIPMENT" | "PER_KG" | "PER_CBM" | "FLAT";
  validFrom?: string;
  validTo?: string;
  freeTimeDays?: number;
  transitTimeDaysMin?: number;
  transitTimeDaysMax?: number;
  carrierName?: string;
  metadata?: {
    notes?: string;
    [key: string]: unknown;
  };
}

export interface PricelistItem extends PricelistItemDto {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PricelistStatus = "draft" | "submitted" | "approved" | "rejected" | "superseded";

export interface Pricelist {
  supplierId: string;
  pricelistId: string;
  weekStart: string;
  weekEnd: string;
  status: PricelistStatus;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  totalCost: number;
  itemCount: number;
  items: PricelistItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SupplierListItem {
  supplierId: string;
  name: string;
  isApproved: boolean;
}

export interface SupplierListResponse {
  data: SupplierListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface PricelistSummary {
  pricelistId: string;
  weekStart: string;
  weekEnd?: string;
  status: PricelistStatus;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  totalCost: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PricelistHistoryResponse {
  supplierId: string;
  pricelists: PricelistSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// =============================================================================
// SERVICE
// =============================================================================

const base = "/agents/pricing";

export const AgentPricingService = {
  /**
   * List all active ports (for port selection in pricelist items)
   * GET /agents/pricing/ports
   */
  getPorts: async () => {
    const { data } = await http.get<{ _id: string; name: string; unlocode?: string }[]>(`${base}/ports`);
    return data;
  },

  /**
   * Step 0: List suppliers the agent can manage
   * GET /agents/pricing/suppliers
   */
  listSuppliers: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const { data } = await http.get<SupplierListResponse>(`${base}/suppliers`, {
      params,
    });
    return data;
  },

  /**
   * Step 1: Get current week pricelist for a supplier
   * GET /agents/pricing/suppliers/:supplierId
   * Returns 404 if no pricelist exists for current week
   */
  getPricelist: async (
    supplierId: string,
    params?: {
      search?: string;
      incoterm?: string;
      currency?: string;
      sort?: string;
      page?: number;
      limit?: number;
    }
  ) => {
    const { data } = await http.get<Pricelist>(
      `${base}/suppliers/${supplierId}`,
      { params }
    );
    return data;
  },

  /**
   * Step 2: Create/Update pricelist (replace all items)
   * PUT /agents/pricing/suppliers/:supplierId
   * Returns 409 Conflict if pricelist already exists with status submitted/approved
   */
  upsertPricelist: async (supplierId: string, items: PricelistItemDto[]) => {
    const { data } = await http.put<Pricelist>(
      `${base}/suppliers/${supplierId}`,
      { items }
    );
    return data;
  },

  /**
   * Add a single item to the current week's pricelist
   * POST /agents/pricing/suppliers/:supplierId/items
   * Creates draft pricelist if none exists
   * Returns 409 Conflict if pricelist is not draft
   */
  addItem: async (supplierId: string, item: PricelistItemDto) => {
    const { data } = await http.post<Pricelist>(
      `${base}/suppliers/${supplierId}/items`,
      item
    );
    return data;
  },

  /**
   * Update a single item in the current week's pricelist
   * PUT /agents/pricing/suppliers/:supplierId/items/:itemId
   * Returns 409 Conflict if pricelist is not draft
   */
  updateItem: async (
    supplierId: string,
    itemId: string,
    item: PricelistItemDto
  ) => {
    const { data } = await http.put<Pricelist>(
      `${base}/suppliers/${supplierId}/items/${itemId}`,
      item
    );
    return data;
  },

  /**
   * Delete an item from the pricelist
   * DELETE /agents/pricing/suppliers/:supplierId/items/:itemId
   * Returns 409 Conflict if pricelist is not draft
   */
  deleteItem: async (supplierId: string, itemId: string) => {
    const { data } = await http.delete<Pricelist>(
      `${base}/suppliers/${supplierId}/items/${itemId}`
    );
    return data;
  },

  /**
   * Step 3: Submit pricelist for approval
   * POST /agents/pricing/suppliers/:supplierId/submit
   * Returns 400 if already submitted or not draft
   */
  submitPricelist: async (supplierId: string) => {
    const { data } = await http.post<Pricelist>(
      `${base}/suppliers/${supplierId}/submit`
    );
    return data;
  },

  /**
   * Step 4: Get pricelist history for a supplier
   * GET /agents/pricing/suppliers/:supplierId/pricelists
   */
  getPricelistHistory: async (
    supplierId: string,
    params?: {
      weekFrom?: string;
      weekTo?: string;
      status?: PricelistStatus;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) => {
    const { data } = await http.get<PricelistHistoryResponse>(
      `${base}/suppliers/${supplierId}/pricelists`,
      { params }
    );
    return data;
  },

  /**
   * Step 5: Get a specific pricelist by ID
   * GET /agents/pricing/pricelists/:pricelistId
   */
  getPricelistById: async (pricelistId: string) => {
    const { data } = await http.get<Pricelist>(
      `${base}/pricelists/${pricelistId}`
    );
    return data;
  },
};