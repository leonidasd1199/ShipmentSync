import http from "../utils/http";

export interface MagicLinkLoginResponse {
  agent: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  access_token: string;
}

const base = "/auth";

export const AgentAuthService = {
  /**
   * Validate magic link token and authenticate agent
   */
  validateMagicLink: async (token: string) => {
    const { data } = await http.post<MagicLinkLoginResponse>(
      `${base}/magic-link/login`,
      { token }
    );
    return data;
  },
};