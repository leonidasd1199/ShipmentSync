export type ClientAddress = {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
};

export type ClientInvoiceInformation = {
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

export type Client = {
    id: string;
    name: string;
    officeId: string;
    officeName: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: ClientAddress;
    taxId?: string;
    invoiceInformation?: ClientInvoiceInformation;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
};

export type CreateClientDto = {
    name: string;
    officeId: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: ClientAddress;
    taxId?: string;
    invoiceInformation: ClientInvoiceInformation;
    isActive?: boolean;
};

export type UpdateClientDto = Partial<CreateClientDto>;
