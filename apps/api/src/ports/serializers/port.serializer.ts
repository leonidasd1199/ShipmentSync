import { PortDocument } from "../../schemas/port.schema";

export interface PortResponse {
  _id: string;
  name: string;
  unlocode?: string;
  countryCode?: string;
  countryName?: string;
  city?: string;
  type: "sea" | "air" | "rail" | "inland" | "other";
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePortResponse {
  id: string;
  name: string;
  createdAt: Date;
}

export class PortSerializer {
  static toResponse(port: PortDocument | any): PortResponse {
    const portObj = port.toObject ? port.toObject() : port;

    return {
      _id: port._id.toString(),
      name: port.name,
      unlocode: port.unlocode,
      countryCode: port.countryCode,
      countryName: port.countryName,
      city: port.city,
      type: port.type,
      latitude: port.latitude,
      longitude: port.longitude,
      isActive: port.isActive,
      createdAt: (portObj as any).createdAt,
      updatedAt: (portObj as any).updatedAt,
    };
  }

  static toCreateResponse(port: PortDocument | any): CreatePortResponse {
    const portObj = port.toObject ? port.toObject() : port;

    return {
      id: port._id.toString(),
      name: port.name,
      createdAt: (portObj as any).createdAt,
    };
  }

  static toListResponse(port: any): PortResponse {
    return {
      _id: port._id.toString(),
      name: port.name,
      unlocode: port.unlocode,
      countryCode: port.countryCode,
      countryName: port.countryName,
      city: port.city,
      type: port.type,
      latitude: port.latitude,
      longitude: port.longitude,
      isActive: port.isActive,
      createdAt: port.createdAt,
      updatedAt: port.updatedAt,
    };
  }
}

