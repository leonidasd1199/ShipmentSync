import http from "../utils/http";
import type { UpdateMyProfileDto, UpdateUserDto } from "../utils/types/user.type";

export const UsersService = {
  updateMyProfile: async (payload: UpdateMyProfileDto) => {
    const { data } = await http.patch("/users/me", payload);
    return data;
  },

  updateUser: async (userId: string, payload: UpdateUserDto) => {
    const { data } = await http.patch(`/users/${userId}`, payload);
    return data;
  },
};

export default UsersService;
