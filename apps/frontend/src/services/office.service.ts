import http from "../utils/http";
import type {
  AssignUsersPayload,
  CreateOfficeDto,
  Office,
  OfficeUser,
  UpdateOfficeDto,
} from "../utils/types/office.type";
import type { AssignNewUserDto } from "../utils/types/user.type";

const base = "/offices";


export const OfficesService = {
  create: async (dto: CreateOfficeDto) => {
    const { data } = await http.post<Office>(base, dto);
    return data;
  },

  findAll: async () => {
    const { data } = await http.get<Office[]>(base);
    return data;
  },

  getByCompany: async (companyId: string) => {
    const { data } = await http.get<Office[]>(`${base}/company/${companyId}`);
    return data;
  },

  getOffice: async (id: string) => {
    const { data } = await http.get<Office>(`${base}/${id}`);
    return data;
  },

  findOne: async (id: string) => {
    const { data } = await http.get<Office>(`${base}/${id}`);
    return data;
  },

  update: async (id: string, dto: UpdateOfficeDto) => {
    const { data } = await http.patch<Office>(`${base}/${id}`, dto);
    return data;
  },

  // PUT /offices/:id (replace full)
  replace: async (id: string, dto: UpdateOfficeDto) => {
    const { data } = await http.put<Office>(`${base}/${id}`, dto);
    return data;
  },

  remove: async (id: string) => {
    await http.delete(`${base}/${id}`);
    return true;
  },

  assignUsers: async (officeId: string, payload: AssignUsersPayload) => {
    const { data } = await http.post<{ success: true }>(
      `${base}/${officeId}/assign-users`,
      payload
    );
    return data;
  },

  removeUsers: async (officeId: string, userId: string) => {
    const { data } = await http.post<{ success: true }>(
      `${base}/${officeId}/remove-users`,
      {userId}
    );
    return data;
  },

  getOfficeUsers: async (officeId: string) => {
    const { data } = await http.get<OfficeUser[]>(`${base}/${officeId}/users`);
    return data;
  },

  getDisabledUsers: async (officeId: string) => {
    const { data } = await http.get<OfficeUser[]>(
      `${base}/${officeId}/disabled-users`
    );
    return data;
  },

  assignNewUser: async (officeId: string, userData: AssignNewUserDto) => {
    const { data } = await http.post(
      `${base}/${officeId}/assign-new-user`,
      userData
    );
    return data;
  },
};
