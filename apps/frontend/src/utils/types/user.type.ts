import type { Company } from "./company.type";
import type { Office } from "./office.type";

export type User = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleCode: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  phone?: string;
  company?: Company;
  offices?: Office[];
  permissions?: string[];
};

export type AssignNewUserDto = {
  firstName: string;
  lastName: string;
  email: string;
  roleCode: string;
  phone?: string;
};

export type UpdateMyProfileDto = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  locale?: string;
  timezone?: string;
};

export type UpdateUserDto = Omit<AssignNewUserDto, "roleCode"> & {
  address?: string;
};
