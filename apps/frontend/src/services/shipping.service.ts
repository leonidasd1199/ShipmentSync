import http from "../utils/http";
import type {
  ShippingLine,
  CreateShippingDto,
  UpdateShippingDto,
} from "../utils/types/shipping.type";

const base = "/shipping-lines";

export const ShippingsService = {
  create: async (dto: CreateShippingDto) => {
    const { data } = await http.post<ShippingLine>(base, dto);
    return data;
  },

  findAll: async () => {
    const { data } = await http.get<ShippingLine[]>(base);
    return data;
  },

  findOne: async (id: string) => {
    const { data } = await http.get<ShippingLine>(`${base}/${id}`);
    return data;
  },

    findByMode: async (mode: string) => {
    const { data } = await http.get<ShippingLine[]>(`${base}/by-mode/${mode}`);
    return data;
  },

  update: async (id: string, dto: UpdateShippingDto) => {
    const { data } = await http.patch<ShippingLine>(`${base}/${id}`, dto);
    return data;
  },

  replace: async (id: string, dto: UpdateShippingDto) => {
    const { data } = await http.put<ShippingLine>(`${base}/${id}`, dto);
    return data;
  },

  remove: async (id: string) => {
    await http.delete(`${base}/${id}`);
    return true;
  },

  addAgents: async (shippingLineId: string, agentIds: string[]) => {
    const { data } = await http.post<{ success: boolean; added: number }>(
      `${base}/${shippingLineId}/agents/add`,
      { agentIds }
    );
    return data;
  },

  removeAgents: async (shippingLineId: string, agentIds?: string[]) => {
    const { data } = await http.delete<{ success: boolean; removed: number; message?: string }>(
      `${base}/${shippingLineId}/agents/remove`,
      { data: agentIds ? { agentIds } : {} }
    );
    return data;
  },
};
