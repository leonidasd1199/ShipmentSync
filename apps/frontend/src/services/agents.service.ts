import http from "../utils/http";
import type { Agent, CreateAgentDto, UpdateAgentDto } from '../utils/types/agent.type'

const base = "/agents";

export const AgentsService = {
  findAll: async (params?: {
    assigned?: "all" | "true" | "false";
    shippingLineId?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const { data } = await http.get<{
      items: Agent[];
      page: number;
      pageSize: number;
      total: number;
    }>(base, { params });
    return data;
  },

  create: async (dto: CreateAgentDto) => {
    const { data } = await http.post<Agent>(base, dto);
    return data;
  },

  update: async (id: string, dto: UpdateAgentDto) => {
    const { data } = await http.put<Agent>(`${base}/${id}`, dto);
    return data;
  },

  removeAgents: async (agentIds: string[]) => {
    const { data } = await http.delete<{ success: boolean; removed: number }>(base, {
      data: { agentIds },
    });
    return data;
  },

  findOne: async (id: string) => {
    const { data } = await http.get<Agent>(`${base}/${id}`);
    return data;
  },

  // Nuevo método para generar magic link
  generateMagicLink: async (agentId: string) => {
    const { data } = await http.post<{ link: string; expiresAt: string }>(
      `${base}/${agentId}/magic-link`
    );
    return data;
  },
};