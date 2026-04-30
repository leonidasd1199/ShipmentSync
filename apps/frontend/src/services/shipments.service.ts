import http from "../utils/http";
import type {
  Shipment,
  CreateShipmentDto,
  UpdateShipmentDto,
  ShipmentFilters,
  ShipmentDocItem,
  LedgerLine,
  LedgerLineDocument,
  ShipmentLedgerRow,
} from "../utils/types/shipment.type";

const base = "/shipments";

export const ShipmentsService = {
  create: async (dto: CreateShipmentDto) => {
    const { data } = await http.post<Shipment>(base, dto);
    return data;
  },

  findAll: async (params?: ShipmentFilters) => {
    const { data } = await http.get<Shipment[]>(base, { params });
    return data;
  },

  getOne: async (id: string) => {
    const { data } = await http.get<Shipment>(`${base}/${id}`);
    return data;
  },

  update: async (id: string, dto: UpdateShipmentDto) => {
    const { data } = await http.patch<Shipment>(`${base}/${id}`, dto);
    return data;
  },

  readyForFinance: async (id: string) => {
    const { data } = await http.post<Shipment>(`${base}/${id}/readyForFinance`);
    return data;
  },

  financeReview: async (id: string) => {
    const { data } = await http.post<Shipment>(`${base}/${id}/financeReview`);
    return data;
  },

  approve: async (id: string, body?: { note?: string }) => {
    const { data } = await http.post<Shipment>(`${base}/${id}/approve`, body ?? {});
    return data;
  },

  rejectFinanceReview: async (id: string, note: string) => {
    const { data } = await http.post<Shipment>(`${base}/${id}/rejectFinanceReview`, {
      note,
    });
    return data;
  },

  close: async (id: string) => {
    const { data } = await http.post<Shipment>(`${base}/${id}/close`);
    return data;
  },

  getDocuments: async (id: string): Promise<{ documents: ShipmentDocItem[]; requiredDocumentTypes: string[] }> => {
    const { data } = await http.get(`${base}/${id}/documents`);
    return data;
  },

  generateDocument: async (id: string, documentType: string): Promise<ShipmentDocItem> => {
    const { data } = await http.post(`${base}/${id}/documents/${documentType}/generate`);
    return data;
  },

  downloadDocumentBlob: async (id: string, documentType: string, version?: number): Promise<Blob> => {
    const { data } = await http.get(
      `${base}/${id}/documents/${documentType}/download${version != null ? `?version=${version}` : ""}`,
      { responseType: "blob" },
    );
    return data;
  },

  getLedgerLines: async (id: string): Promise<LedgerLine[]> => {
    const { data } = await http.get(`${base}/${id}/ledgerLines`);
    return data;
  },

  getAllLedgerRowsBySide: async (
    side: "DEBIT" | "CREDIT",
  ): Promise<ShipmentLedgerRow[]> => {
    const shipments = await ShipmentsService.findAll();
    const rows = await Promise.all(
      shipments.map(async (shipment) => {
        try {
          const lines = await ShipmentsService.getLedgerLines(shipment._id);
          return lines
            .filter((line) => line.side === side)
            .map((line) => ({ shipment, line }));
        } catch {
          return [];
        }
      }),
    );
    return rows.flat();
  },

  createLedgerLine: async (
    id: string,
    dto: { side: "DEBIT" | "CREDIT"; description: string; amount: number; currency: string },
  ): Promise<LedgerLine> => {
    const { data } = await http.post(`${base}/${id}/ledgerLines`, dto);
    return data;
  },

  deleteLedgerLine: async (id: string, lineId: string): Promise<void> => {
    await http.post(`${base}/${id}/ledgerLines/${lineId}/delete`);
  },

  getLedgerLineDocuments: async (
    shipmentId: string,
    lineId: string,
  ): Promise<LedgerLineDocument[]> => {
    const { data } = await http.get<LedgerLineDocument[]>(
      `${base}/${shipmentId}/ledgerLines/${lineId}/documents`,
    );
    return data;
  },

  uploadLedgerLineDocument: async (
    shipmentId: string,
    lineId: string,
    file: File,
    options?: { note?: string },
  ): Promise<LedgerLineDocument> => {
    const formData = new FormData();
    formData.append("file", file);
    const trimmed = options?.note?.trim();
    if (trimmed) {
      formData.append("note", trimmed);
    }
    const { data } = await http.post<LedgerLineDocument>(
      `${base}/${shipmentId}/ledgerLines/${lineId}/documents`,
      formData,
    );
    return data;
  },

  downloadLedgerLineDocumentBlob: async (
    shipmentId: string,
    lineId: string,
    documentId: string,
  ): Promise<Blob> => {
    const { data } = await http.get(
      `${base}/${shipmentId}/ledgerLines/${lineId}/documents/${documentId}/download`,
      { responseType: "blob" },
    );
    return data;
  },

  deleteLedgerLineDocument: async (
    shipmentId: string,
    lineId: string,
    documentId: string,
  ): Promise<{ documentId: string; isActive: boolean }> => {
    const { data } = await http.delete(
      `${base}/${shipmentId}/ledgerLines/${lineId}/documents/${documentId}`,
    );
    return data;
  },
};
