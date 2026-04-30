import http from "../utils/http";
import type { Port } from "../utils/types/port.type";

const base = "/ports";

export const PortsService = {
  create: async (dto: Partial<Port>) => {
    const { data } = await http.post<Port>(base, dto);
    return data;
  },

  findAll: async () => {
    const { data } = await http.get<Port[]>(base);
    return data;
  },

  findOne: async (id: string) => {
    const { data } = await http.get<Port>(`${base}/${id}`);
    return data;
  },

  update: async (id: string, dto: Partial<Port>) => {
    const { data } = await http.patch<Port>(`${base}/${id}`, dto);
    return data;
  },

  remove: async (id: string) => {
    await http.delete(`${base}/${id}`);
    return true;
  },

  findByMode: async (mode: "maritime" | "air" | "road") => {
    const { data } = await http.get<Port[]>(base, {
      params: { mode },
    });
    return data;
  },

  findByCountry: async (country: string) => {
    const { data } = await http.get<Port[]>(base, {
      params: { country },
    });
    return data;
  },
};
