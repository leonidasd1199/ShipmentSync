import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthenticatedAgent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  shippingLineId?: string;
  shippingLineName?: string;
}

type AgentAuthState = {
  token: string | null;
  agent: AuthenticatedAgent | null;
  setSession: (token: string, agent: AuthenticatedAgent | null) => void;
  setAgent: (agent: AuthenticatedAgent | null) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAgentAuthStore = create<AgentAuthState>()(
  persist(
    (set, get) => ({
      token: null,
      agent: null,

      setSession: (token, agent) => set({ token, agent }),

      setAgent: (agent) => set((state) => ({
        ...state,
        agent,
      })),

      logout: () => set({ token: null, agent: null }),

      isAuthenticated: () => {
        const state = get();
        return !!(state.token && state.agent);
      },
    }),
    { name: 'agent-auth-store' },
  ),
)