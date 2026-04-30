import http from "../utils/http";
import type {
    CreateQuotationDto,
    UpdateQuotationDto,
    QuotationResponse,
    QuotationListResponse,
    QuotationFilters,
} from "../utils/types/quotation.type";
import type { Company } from "../utils/types/company.type";
import type { ShippingLine } from "../utils/types/shipping.type";

export interface MetadataOption {
    value: string;
    label: string;
}

const base = "/quotations";
const metadataBase = "/metadata";

export const QuotationsService = {
    create: async (dto: CreateQuotationDto) => {
        const { data } = await http.post<QuotationResponse>(base, dto);
        return data;
    },

    findAll: async (params?: QuotationFilters) => {
        const { data } = await http.get<QuotationListResponse>(base, {
            params,
        });
        return data;
    },

    getOne: async (id: string) => {
        const { data } = await http.get<QuotationResponse>(`${base}/${id}`);
        return data;
    },

    update: async (id: string, dto: UpdateQuotationDto) => {
        const { data } = await http.put<QuotationResponse>(`${base}/${id}`, dto);
        return data;
    },

    replace: async (id: string, dto: UpdateQuotationDto) => {
        const { data } = await http.put<QuotationResponse>(
            `${base}/${id}`,
            dto
        );
        return data;
    },

    remove: async (id: string) => {
        await http.delete(`${base}/${id}`);
        return true;
    },

    downloadPdf: async (id: string): Promise<Blob> => {
        const { data } = await http.get(`${base}/${id}/pdf`, {
            responseType: "blob",
        });
        return data;
    },

    getShippingLinesHelper: async () => {
        const { data } = await http.get<Pick<ShippingLine, "_id" | "name">[]>(
            `${base}/helpers/shipping-lines`
        );
        return data;
    },

    getAgentsHelper: async () => {
        const { data } = await http.get<{ _id: string; name: string; shippingLineId: string }[]>(
            `${base}/helpers/agents`
        );
        return data;
    },

    getCompanyHelper: async () => {
        const { data } = await http.get<Company>(
            `${base}/helpers/company`
        );
        return data;
    },

    getClientsHelper: async () => {
        const { data } = await http.get<{ _id: string; clientName: string }[]>(
            `${base}/helpers/clients`
        );
        return data;
    },

    getServiceTypes: async (): Promise<MetadataOption[]> => {
        const { data } = await http.get<MetadataOption[]>(`${metadataBase}/service-types`);
        return Array.isArray(data) ? data : [];
    },

    getIncoterms: async (serviceType: string): Promise<string[]> => {
        const { data } = await http.get<string[]>(`${metadataBase}/incoterms/${serviceType}`);
        return Array.isArray(data) ? data : [];
    },

    getShippingModes: async (): Promise<string[]> => {
        const { data } = await http.get<string[]>(`${metadataBase}/shipping-modes`);
        return Array.isArray(data) ? data : [];
    },
};
