import http from "../utils/http";
import type { OfficeUser } from "../utils/types/office.type";

const base = "/companies";

export const CompaniesService = {
  getCompanyUsers: async (companyId: string) => {
    const { data } = await http.get<OfficeUser[]>(`${base}/${companyId}/users`);
    return data;
  },
};
