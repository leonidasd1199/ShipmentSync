import http from "../utils/http";
import type { Client, CreateClientDto, UpdateClientDto } from "../utils/types/client.type";

const base = "/clients";

export const ClientsService = {
  create: async (dto: CreateClientDto) => {
    const { data } = await http.post<Client>(base, dto);
    return data;
  },

  findAll: async () => {
    const { data } = await http.get<any[]>(base);
    return data.map((c) => ({ ...c, id: c.id ?? c._id })) as Client[];
  },

  getClient: async (id: string) => {
    const { data } = await http.get<Client>(`${base}/${id}`);
    return data;
  },

  findOne: async (id: string) => {
    const { data } = await http.get<Client>(`${base}/${id}`);
    return data;
  },

  update: async (id: string, dto: UpdateClientDto) => {
    const { data } = await http.patch<Client>(`${base}/${id}`, dto);
    return data;
  },

  replace: async (id: string, dto: UpdateClientDto) => {
    const { data } = await http.put<Client>(`${base}/${id}`, dto);
    return data;
  },

  remove: async (id: string) => {
    await http.delete(`${base}/${id}`);
    return true;
  },
};
