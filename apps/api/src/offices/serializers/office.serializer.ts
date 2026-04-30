import { OfficeDocument } from "../../schemas/office.schema";

export interface OfficeInvoicingResponse {
  cai?: string;
  ein?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  invoiceRange?: {
    from: number;
    to: number;
  };
  lastUsedInvoiceNumber?: number;
}

export interface OfficeResponse {
  _id: string;
  name: string;
  company: {
    _id: string;
    name: string;
  };
  description?: string;
  type?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  invoicing?: OfficeInvoicingResponse;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class OfficeSerializer {
  static toResponse(office: OfficeDocument | any): OfficeResponse {
    const officeObj = office.toObject ? office.toObject() : office;
    
    return {
      _id: office._id.toString(),
      name: office.name,
      company: {
        _id: office.company?._id?.toString() || office.company?.toString(),
        name: office.company?.name || "",
      },
      description: office.description,
      type: office.type,
      email: office.email,
      phone: office.phone,
      address: office.address,
      invoicing: office.invoicing
        ? {
            cai: office.invoicing.cai,
            ein: office.invoicing.ein,
            email: office.invoicing.email,
            address: office.invoicing.address,
            invoiceRange: office.invoicing.invoiceRange,
            lastUsedInvoiceNumber: office.invoicing.lastUsedInvoiceNumber,
          }
        : undefined,
      isActive: office.isActive,
      createdAt: (officeObj as any).createdAt,
      updatedAt: (officeObj as any).updatedAt,
    };
  }

  static toListResponse(office: any): OfficeResponse {
    return {
      _id: office._id.toString(),
      name: office.name,
      company: {
        _id: office.company?._id?.toString() || office.company?.toString(),
        name: office.company?.name || "",
      },
      description: office.description,
      type: office.type,
      email: office.email,
      phone: office.phone,
      address: office.address,
      invoicing: office.invoicing
        ? {
            cai: office.invoicing.cai,
            ein: office.invoicing.ein,
            email: office.invoicing.email,
            address: office.invoicing.address,
            invoiceRange: office.invoicing.invoiceRange,
            lastUsedInvoiceNumber: office.invoicing.lastUsedInvoiceNumber,
          }
        : undefined,
      isActive: office.isActive,
      createdAt: office.createdAt,
      updatedAt: office.updatedAt,
    };
  }
}

