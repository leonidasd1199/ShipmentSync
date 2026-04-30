export type OfficeAddress = {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    _id?: string;
  };

  export type OfficeInvoicingAddress = {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };

  export type OfficeInvoiceRange = {
    from: number;
    to: number;
  };

  export type OfficeInvoicing = {
    cai?: string;
    ein: string;
    email: string;
    address: OfficeInvoicingAddress;
    invoiceRange: OfficeInvoiceRange;
    /** From API — highest invoice number already used */
    lastUsedInvoiceNumber?: number;
  };
  
  export type OfficeType =
    | "headquarters"
    | "warehouse"
    | "operations"
    | "distribution"
    | "hub"
    | "branch";
  
  export type Office = {
    id: string;
    name: string;
    email?: string;
    address?: OfficeAddress;
    phone?: string;
    companyId: string;
    description?: string;   
    type: OfficeType;
    invoicing?: OfficeInvoicing;
  };
  
  export type CreateOfficeDto = {
    name: string;
    companyId: string;
    email?: string;
    address?: OfficeAddress;
    phone?: string;
    description?: string;   
    type: OfficeType;
    invoicing?: OfficeInvoicing;
  };

  export type OfficeUser = {
    _id: string;
    email: string;
    name?: string;
    roleCode?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    isActive?: boolean;
    lastLoginAt?: string | Date;
  };
  
  export type UpdateOfficeDto = Partial<Omit<CreateOfficeDto, "companyId">> & {
    companyId?: string;
  };
  
  export type AssignUsersPayload = { userIds: string[] };
  