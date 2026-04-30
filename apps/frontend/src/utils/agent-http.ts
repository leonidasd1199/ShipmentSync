// src/utils/agent-http.ts
import axios from "axios";
import { useAgentAuthStore } from "../stores/agent-auth.store";

const agentHttp = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

agentHttp.interceptors.request.use((config) => {
  const token = useAgentAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default agentHttp;