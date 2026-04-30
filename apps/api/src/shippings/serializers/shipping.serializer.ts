import { ShippingDocument } from "../../schemas/shipping.schema";

export interface ShippingResponse {
  _id: string;
  name: string;
  legalName?: string;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
  agents?: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  }>;
  shippingModes: ("maritime" | "air" | "road")[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShippingResponse {
  id: string;
  name: string;
  createdAt: Date;
}

export class ShippingSerializer {
  static toResponse(shipping: ShippingDocument | any): ShippingResponse {
    const shippingObj = shipping.toObject ? shipping.toObject() : shipping;
    
    return {
      _id: shipping._id.toString(),
      name: shipping.name,
      legalName: shipping.legalName,
      email: shipping.email,
      phone: shipping.phone,
      website: shipping.website,
      notes: shipping.notes,
      agents: shipping.agents?.map((agent: any) => ({
        _id: agent._id?.toString() || agent.toString(),
        firstName: agent.firstName,
        lastName: agent.lastName,
        email: agent.email,
        phone: agent.phone,
      })),
      shippingModes: shipping.shippingModes || [],
      isActive: shipping.isActive,
      createdAt: (shippingObj as any).createdAt,
      updatedAt: (shippingObj as any).updatedAt,
    };
  }

  static toCreateResponse(shipping: ShippingDocument | any): CreateShippingResponse {
    const shippingObj = shipping.toObject ? shipping.toObject() : shipping;
    
    return {
      id: shipping._id.toString(),
      name: shipping.name,
      createdAt: (shippingObj as any).createdAt,
    };
  }

  static toListResponse(shipping: any): ShippingResponse {
    return {
      _id: shipping._id.toString(),
      name: shipping.name,
      legalName: shipping.legalName,
      email: shipping.email,
      phone: shipping.phone,
      website: shipping.website,
      notes: shipping.notes,
      agents: shipping.agents?.map((agent: any) => {
        // Handle both populated and non-populated agents
        if (typeof agent === 'object' && agent !== null) {
          return {
            _id: agent._id?.toString() || agent.toString(),
            firstName: agent.firstName,
            lastName: agent.lastName,
            email: agent.email,
            phone: agent.phone,
          };
        }
        return undefined;
      }).filter(Boolean),
      shippingModes: shipping.shippingModes || [],
      isActive: shipping.isActive,
      createdAt: shipping.createdAt,
      updatedAt: shipping.updatedAt,
    };
  }
}

