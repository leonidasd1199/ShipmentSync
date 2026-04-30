import http from "../utils/http";

const base = "/clients";

export type ClientPriceListQuery = {
  dateFrom?: string; // ISO 8601
  dateTo?: string; // ISO 8601
};

/** Delivery item from GET /clients/price-list */
export type ClientPriceListItem = {
  _id?: string;
  quotationSnapshot: Record<string, unknown>;
  sentAt: string;
  sentBy?: string;
  companyId?: string;
  officeId?: string;
};

export const ClientUserService = {
  getPriceList: async (query?: ClientPriceListQuery): Promise<ClientPriceListItem[]> => {
    const params = new URLSearchParams();
    if (query?.dateFrom) params.set("dateFrom", query.dateFrom);
    if (query?.dateTo) params.set("dateTo", query.dateTo);
    const { data } = await http.get(`${base}/price-list`, { params });
    return Array.isArray(data) ? data : [];
  },

  getShipments: async () => {
    const { data } = await http.get(`${base}/shipments`);
    return data;
  },

  downloadDeliveryPdf: async (deliveryId: string): Promise<Blob> => {
    const { data } = await http.get(`${base}/price-list/${deliveryId}/pdf`, {
      responseType: "blob",
    });
    return data as Blob;
  },

};