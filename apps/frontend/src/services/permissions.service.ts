import http from "../utils/http";
import type { User } from "../utils/types/user.type";

const base = "/users";

export const PermissionsService = {
  getAll: async () => {
    const { data } = await http.get<{
      permissions: Array<{ id: string; code: string; description: string }>;
    }>(`${base}/all-permissions`);
    return data;
  },

  assignToUser: async (userId: string, permissionCodes: string[]) => {
    const { data } = await http.post(`${base}/${userId}/permissions`, {
      permissionCodes,
    });
    return data;
  },

  removeFromUser: async (userId: string, permissionCodes: string[]) => {
    const { data } = await http.delete(`${base}/${userId}/permissions`, {
      data: { permissionCodes },
    });
    return data;
  },

  getCompanyUsersWithPermissions: async (companyId: string) => {
    const { data } = await http.get<{
      users: Array<User & { office_disabled?: boolean }>;
    }>(`${base}/company/${companyId}/with-permissions`);
    return data;
  },
};
