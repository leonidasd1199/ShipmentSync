import http from "../utils/http";

export async function login(payload: { email: string; password: string }) {
  const { data } = await http.post("/auth/login", payload, { skipAuth: true });
  return data;
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
}) {
  const { data } = await http.post("/auth/change-password", payload);
  return data;
}

export async function getMyProfile() {
  const { data } = await http.get("/users/me");
  return data;
}
