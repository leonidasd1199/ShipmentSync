import { ClientDocument } from "../../schemas/client.schema";

export interface ClientResponse {
  _id: string;
  name: string;
  office: {
    _id: string;
    name: string;
  };
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  taxId?: string;
  invoiceInformation?: {
    billingAddress: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    invoiceEmail: string;
    paymentTerms: string;
    taxRegimeOrVatNumber: string;
    currency: string;
    preferredPaymentMethod: string;
  };
  isActive: boolean;
  lastContactDate?: Date;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class ClientSerializer {
  static toResponse(client: ClientDocument | any): ClientResponse {
    const clientObj = client.toObject ? client.toObject() : client;
    
    return {
      _id: client._id.toString(),
      name: client.name,
      office: {
        _id: client.office?._id?.toString() || client.office?.toString(),
        name: client.office?.name || "",
      },
      contactPerson: client.contactPerson,
      email: client.email,
      phone: client.phone,
      address: client.address,
      taxId: client.taxId,
      invoiceInformation: client.invoiceInformation,
      isActive: client.isActive,
      lastContactDate: client.lastContactDate,
      tags: client.tags,
      createdAt: (clientObj as any).createdAt,
      updatedAt: (clientObj as any).updatedAt,
    };
  }

  static toListResponse(client: any): ClientResponse {
    return {
      _id: client._id.toString(),
      name: client.name,
      office: {
        _id: client.office?._id?.toString() || client.office?.toString(),
        name: client.office?.name || "",
      },
      contactPerson: client.contactPerson,
      email: client.email,
      phone: client.phone,
      address: client.address,
      taxId: client.taxId,
      invoiceInformation: client.invoiceInformation,
      isActive: client.isActive,
      lastContactDate: client.lastContactDate,
      tags: client.tags,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }
}

