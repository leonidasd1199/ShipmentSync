import http from "../utils/http";
import type { Pricelist, PricelistStatus } from "./pricing.service";

// =============================================================================
// TYPES
// =============================================================================

export interface OperatorPricelist {
  pricelistId: string;
  weekStart: string;
  weekEnd?: string;
  status: PricelistStatus;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  totalCost: number;
  itemCount: number;
  agent: {
    id: string;
    name: string;
    email: string;
  };
  items: Array<{
    id: string;
    name: string;
    chargeType?: string;
    incoterm: string;
    equipmentType?: string;
    lane?: {
      originPortCode?: string;
      destinationPortCode?: string;
      originName?: string;
      destinationName?: string;
    };
    cost: number;
    profit: number;
    currency: string;
    metadata?: {
      notes?: string;
      [key: string]: unknown;
    };
  }>;
  updatedAt: string;
  createdAt: string;
}

export interface OperatorPricelistResponse {
  supplier: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  pricelists: OperatorPricelist[];
}

export interface ApproveRejectResponse extends Pricelist {
  pricelistId: string;
  status: PricelistStatus;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

/** Snapshot payload so QuotationDelivery matches the PDF (legacyItems, total, validUntil). */
export interface QuoteSnapshotPayload {
  legacyItems?: Array<{ type: "cargo" | "custom"; description: string; price: number; notes?: string }>;
  total?: number;
  validUntil?: string;
}

export interface SendToClientsRequest {
  /** Original quotation saved from Create Quote screen (canonical). */
  quotationId?: string;
  pricelistId: string;
  clientIds?: string[];
  sendToAll: boolean;
  pdf: File;
  quoteSnapshot?: QuoteSnapshotPayload;
}

export interface SendToClientsResponse {
  success: boolean;
  message: string;
  pricelistId?: string;
  totalClients?: number;
  clientIds?: string[];
  sentAt?: string;
  distributionId?: string;
}

// =============================================================================
// SERVICE
// =============================================================================

const base = "/pricing";

export const OperatorPricingService = {
  getSupplierPricelists: async (
    supplierId: string,
    params?: {
      agentId?: string;
      incoterm?: string;
      currency?: string;
      status?: PricelistStatus;
    }
  ) => {
    const { data } = await http.get<OperatorPricelistResponse>(
      `${base}/suppliers/${supplierId}`,
      { params }
    );
    return data;
  },

  approvePricelist: async (pricelistId: string) => {
    const { data } = await http.post<ApproveRejectResponse>(
      `${base}/pricelists/${pricelistId}/approve`
    );
    return data;
  },

  rejectPricelist: async (pricelistId: string, rejectionReason: string) => {
    const { data } = await http.post<ApproveRejectResponse>(
      `${base}/pricelists/${pricelistId}/reject`,
      { rejectionReason }
    );
    return data;
  },

  sendToClients: async (request: SendToClientsRequest) => {
    const form = new FormData();

    if (request.quotationId) {
      form.append("quotationId", request.quotationId);
    }
    form.append("pricelistId", request.pricelistId);
    form.append("sendToAll", String(request.sendToAll));

    if (!request.sendToAll) {
      (request.clientIds ?? []).forEach((id) => form.append("clientIds", id));
    }

    if (request.quoteSnapshot != null) {
      form.append("quoteSnapshot", JSON.stringify(request.quoteSnapshot));
      // Send legacyItems in a separate field so the array is never truncated (avoids multipart/JSON size quirks)
      if (Array.isArray(request.quoteSnapshot.legacyItems) && request.quoteSnapshot.legacyItems.length > 0) {
        form.append("quoteSnapshotLegacyItems", JSON.stringify(request.quoteSnapshot.legacyItems));
      }
    }

    form.append("pdf", request.pdf, request.pdf.name);

    const { data } = await http.post<SendToClientsResponse>(
      `${base}/send-to-clients`,
      form
    );

    return data;
  },
};
