import { UserDocument } from "../../schemas/user.schema";

export interface UserResponse {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleCode: string;
  role?: {
    _id: string;
    code: string;
    name: string;
  };
  company?: {
    _id: string;
    name: string;
  };
  offices?: Array<{
    _id: string;
    name: string;
  }>;
  permissions?: Array<{
    _id: string;
    code: string;
    name: string;
  }>;
  isActive: boolean;
  phone?: string;
  address?: string;
  avatar?: string;
  locale?: string;
  timezone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserSerializer {
  static toResponse(user: UserDocument | any): UserResponse {
    const userObj = user.toObject ? user.toObject() : user;
    
    return {
      _id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roleCode: user.roleCode,
      role: user.role
        ? {
            _id: user.role._id?.toString() || user.role.toString(),
            code: user.role.code,
            name: user.role.name,
          }
        : undefined,
      company: user.company
        ? {
            _id: user.company._id?.toString() || user.company.toString(),
            name: user.company.name,
          }
        : undefined,
      offices: user.offices?.map((office: any) => ({
        _id: office._id?.toString() || office.toString(),
        name: office.name,
      })),
      permissions: user.permissions?.map((permission: any) => ({
        _id: permission._id?.toString() || permission.toString(),
        code: permission.code,
        name: permission.name,
      })),
      isActive: user.isActive,
      phone: user.phone,
      address: user.address,
      avatar: user.avatar,
      locale: user.locale,
      timezone: user.timezone,
      createdAt: (userObj as any).createdAt,
      updatedAt: (userObj as any).updatedAt,
    };
  }

  static toListResponse(user: any): UserResponse {
    return {
      _id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roleCode: user.roleCode,
      role: user.role
        ? {
            _id: user.role._id?.toString() || user.role.toString(),
            code: user.role.code,
            name: user.role.name,
          }
        : undefined,
      company: user.company
        ? {
            _id: user.company._id?.toString() || user.company.toString(),
            name: user.company.name,
          }
        : undefined,
      offices: user.offices?.map((office: any) => ({
        _id: office._id?.toString() || office.toString(),
        name: office.name,
      })),
      permissions: user.permissions?.map((permission: any) => ({
        _id: permission._id?.toString() || permission.toString(),
        code: permission.code,
        name: permission.name,
      })),
      isActive: user.isActive,
      phone: user.phone,
      address: user.address,
      avatar: user.avatar,
      locale: user.locale,
      timezone: user.timezone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

