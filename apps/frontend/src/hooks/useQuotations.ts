/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
    CreateQuotationDto,
    UpdateQuotationDto,
    QuotationListItemResponse,
    QuotationListResponse,
    QuotationFilters,
    QuotationResponse,
} from "../utils/types/quotation.type";
import { QuotationsService } from "../services/quotations.service";
import { QuotationStatusEnum } from "../utils/constants";

type UseQuotationsOptions = {
    autoload?: boolean;
    defaultPage?: number;
    defaultPageSize?: number;
    defaultFilters?: QuotationFilters;
};

export type UseQuotationsReturn = {
    quotations: QuotationListItemResponse[];
    isLoading: boolean;
    error: unknown;

    page: number;
    pageSize: number;
    total: number;

    filters: QuotationFilters;
    setFilters: (filters: any) => void;

    refresh: () => Promise<void>;
    setPage: (p: number) => void;
    setPageSize: (s: number) => void;

    createQuotation: (dto: CreateQuotationDto) => Promise<QuotationListItemResponse>;
    updateQuotation: (id: string, dto: UpdateQuotationDto) => Promise<QuotationListItemResponse>;
    replaceQuotation: (id: string, dto: UpdateQuotationDto) => Promise<QuotationListItemResponse>;
    deleteQuotation: (id: string) => Promise<void>;
    getQuotation: (id: string) => Promise<QuotationResponse>;

    acceptQuotation: (id: string) => Promise<QuotationListItemResponse>;
    rejectQuotation: (id: string) => Promise<QuotationListItemResponse>;

    /** ✅ PDF */
    downloadQuotationPdf: (id: string) => Promise<Blob>;
};

export const mapQuotationFromApi = (q: any): QuotationListItemResponse => ({
    id: q.id ?? q._id,
    clientId: q.clientId,
    client: q.client,
    companyId: q.companyId,
    company: q.company,
    shippingLineId: q.shippingLineId,
    shippingLine: q.shippingLine,
    agentId: q.agentId,
    agent: q.agent,
    items: q.items ?? [],
    notes: q.notes,
    validUntil: q.validUntil,
    summarize: q.summarize,
    total: q.total,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
    status: q.status,
});

export function useQuotations(
    opts: UseQuotationsOptions = {},
): UseQuotationsReturn {
    const {
        autoload = true,
        defaultPage = 1,
        defaultPageSize = 10,
        defaultFilters = {
            shippingLineId: undefined,
            clientId: undefined,
            agentId: undefined,
            status: undefined,
            chargeType: undefined,
            createdAtFrom: undefined,
            createdAtTo: undefined,
        },
    } = opts;

    const [quotations, setQuotations] = useState<QuotationListItemResponse[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(!!autoload);
    const [error, setError] = useState<unknown>(null);

    const [page, setPage] = useState<number>(defaultPage);
    const [pageSize, setPageSize] = useState<number>(defaultPageSize);
    const [total, setTotal] = useState<number>(0);

    const [filters, setFilters] = useState<QuotationFilters>(defaultFilters);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const params: QuotationFilters = {
                ...filters,
                page,
                limit: pageSize,
            };

            const res: QuotationListResponse =
                await QuotationsService.findAll(params);

            const mapped: QuotationListResponse = {
                items: (res.items ?? []).map(mapQuotationFromApi),
                page: res.page ?? page,
                limit: res.limit ?? pageSize,
                total: res.total ?? 0,
            };

            setQuotations(mapped.items);
            if (mapped.page !== page) setPage(mapped.page);
            if (mapped.limit !== pageSize) setPageSize(mapped.limit);
            if (mapped.total !== total) setTotal(mapped.total);
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    }, [filters, page, pageSize, total]);

    useEffect(() => {
        if (autoload) void load();
    }, [autoload, load]);

    const refresh = useCallback(async () => {
        await load();
    }, [load]);

    const createQuotation = useCallback(
        async (dto: CreateQuotationDto) => {
            const created = await QuotationsService.create(dto);
            const mapped = mapQuotationFromApi(created as any);
            setQuotations((prev) => [mapped, ...prev]);
            setTotal((t) => t + 1);
            return mapped;
        },
        [],
    );

    const updateQuotation = useCallback(
        async (id: string, dto: UpdateQuotationDto) => {
            const updated = await QuotationsService.update(id, dto);
            const mapped = mapQuotationFromApi(updated as any);

            setQuotations((prev) =>
                prev.map((q) => (q.id === id ? { ...q, ...mapped } : q)),
            );

            return mapped;
        },
        [],
    );

    const replaceQuotation = useCallback(
        async (id: string, dto: UpdateQuotationDto) => {
            const replaced = await QuotationsService.replace(id, dto);
            const mapped = mapQuotationFromApi(replaced as any);

            setQuotations((prev) =>
                prev.map((q) => (q.id === id ? { ...q, ...mapped } : q)),
            );

            return mapped;
        },
        [],
    );

    const deleteQuotation = useCallback(async (id: string) => {
        await QuotationsService.remove(id);
        setQuotations((prev) => prev.filter((q) => q.id !== id));
        setTotal((t) => Math.max(0, t - 1));
    }, []);

    const getQuotation = useCallback(async (id: string) => {
        const data = await QuotationsService.getOne(id);
        return data as QuotationResponse;
    }, []);

    const acceptQuotation = useCallback(
        async (id: string) => {
            return updateQuotation(id, {
                status: QuotationStatusEnum.Accepted,
            });
        },
        [updateQuotation],
    );

    const rejectQuotation = useCallback(
        async (id: string) => {
            return updateQuotation(id, {
                status: QuotationStatusEnum.Rejected,
            });
        },
        [updateQuotation],
    );

    /** ✅ DOWNLOAD PDF */
    const downloadQuotationPdf = useCallback(async (id: string) => {
        return QuotationsService.downloadPdf(id);
    }, []);

    return useMemo(
        () => ({
            quotations,
            isLoading,
            error,
            page,
            pageSize,
            total,
            filters,
            setFilters,
            refresh,
            setPage,
            setPageSize,
            createQuotation,
            updateQuotation,
            replaceQuotation,
            deleteQuotation,
            getQuotation,
            acceptQuotation,
            rejectQuotation,
            downloadQuotationPdf,
        }),
        [
            quotations,
            isLoading,
            error,
            page,
            pageSize,
            total,
            filters,
            refresh,
            setPage,
            setPageSize,
            createQuotation,
            updateQuotation,
            replaceQuotation,
            deleteQuotation,
            getQuotation,
            acceptQuotation,
            rejectQuotation,
            downloadQuotationPdf,
        ],
    );
}
