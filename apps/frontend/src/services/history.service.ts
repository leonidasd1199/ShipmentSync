import http from "../utils/http";

export interface HistoryQuery {
  entityType: string;
  entityId: string;
  page?: number;
  pageSize?: number;
  action?: string;
  from?: string;
  to?: string;
}

export interface HistoryItem {
  _id: string;
  action: string;
  summary: string;
  actorName: string;
  timestamp: string;
  status: string;
}

export interface HistoryResponse {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
  items: HistoryItem[];
}

export const HistoryService = {
  async findAll(params: HistoryQuery): Promise<HistoryResponse> {
    const { entityType, entityId, page = 1, pageSize = 10, action, from, to } = params;

    const query = new URLSearchParams();
    query.set("entityType", entityType);
    query.set("entityId", entityId);
    query.set("page", String(page));
    query.set("pageSize", String(pageSize));
    if (action) query.set("action", action);
    if (from) query.set("from", from);
    if (to) query.set("to", to);

    const { data } = await http.get<HistoryResponse>(`/history?${query.toString()}`);
    return data;
  },
};
