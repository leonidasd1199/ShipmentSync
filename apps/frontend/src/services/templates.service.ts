import http from "../utils/http";
import type { Template, TemplateFilters } from "../utils/types/template.type";

const base = "/templates";

export const TemplatesService = {
  async find(filters: TemplateFilters) {
    const { data } = await http.get<Template[]>(base, {
      params: {
        serviceType: filters.serviceType,
        category: filters.category,
        shippingMode: filters.shippingMode,
        isActive: filters.isActive,
      },
    });
    return data;
  },

  async findOne(id: string) {
    const { data } = await http.get<Template>(`${base}/${id}`);
    return data;
  },

  async create(dto: any) {
    const { data } = await http.post(base, dto);
    return data;
  },

  async update(id: string, dto: any) {
    const { data } = await http.patch(`${base}/${id}`, dto);
    return data;
  },

  async remove(id: string) {
    const { data } = await http.delete(`${base}/${id}`);
    return data;
  },
};
