/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
    Agent,
    CreateAgentDto,
    UpdateAgentDto,
    PaginatedAgentsResponse,
} from "../utils/types/agent.type";
import { AgentsService } from "../services/agents.service";

type UseAgentsOptions = {
    autoload?: boolean;
    defaultAssigned?: "all" | "true" | "false";
    defaultShippingLineId?: string | null;
    defaultPage?: number;
    defaultPageSize?: number;
};

type UseAgentsReturn = {
    agents: Agent[];
    isLoading: boolean;
    error: unknown;
    page: number;
    pageSize: number;
    total: number;
    assigned: "all" | "true" | "false";
    shippingLineId?: string | null;

    refresh: () => Promise<void>;
    setPage: (p: number) => void;
    setPageSize: (s: number) => void;
    setAssigned: (a: "all" | "true" | "false") => void;
    setShippingLineId: (id: string | null | undefined) => void;

    createAgent: (dto: CreateAgentDto) => Promise<Agent>;
    updateAgent: (id: string, dto: UpdateAgentDto) => Promise<Agent>;
    removeAgents: (ids: string[]) => Promise<{ success: boolean; removed: number }>;
    getAgent: (id: string) => Promise<Agent>;
};

export const mapAgentFromApi = (a: any): Agent => ({
    id: a.id ?? a._id,
    firstName: a.firstName,
    lastName: a.lastName,
    email: a.email,
    phone: a.phone,
    whatsapp: a.whatsapp ?? null,
    address: {
        street: a.address?.street,
        city: a.address?.city,
        country: a.address?.country,
        state: a.address?.state,
        zip: a.address?.zip,
    },
    notes: a.notes ?? null,
    shippingLines: Array.isArray(a.shippingLines)
        ? a.shippingLines.map((sl: any) => ({
            id: sl.id ?? sl._id,
            name: sl.name,
        }))
        : [],
    isActive: Boolean(a.isActive ?? true),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
});

export function useAgents(opts: UseAgentsOptions = {}): UseAgentsReturn {
    const {
        autoload = true,
        defaultAssigned = "all",
        defaultShippingLineId = null,
        defaultPage = 1,
        defaultPageSize = 2,
    } = opts;

    const [agents, setAgents] = useState<Agent[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(!!autoload);
    const [error, setError] = useState<unknown>(null);

    const [page, setPage] = useState<number>(defaultPage);
    const [pageSize, setPageSize] = useState<number>(defaultPageSize);
    const [total, setTotal] = useState<number>(0);
    const [assigned, setAssigned] = useState<"all" | "true" | "false">(defaultAssigned);
    const [shippingLineId, setShippingLineId] = useState<string | null | undefined>(
        defaultShippingLineId,
    );

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await AgentsService.findAll({
                assigned,
                shippingLineId: shippingLineId ?? undefined,
                page,
                pageSize,
            });
            const mapped: PaginatedAgentsResponse = {
                items: (res.items ?? []).map(mapAgentFromApi),
                page: res.page ?? page,
                pageSize: res.pageSize ?? pageSize,
                total: res.total ?? 0,
            };
            setAgents(mapped.items);
            if (mapped.page !== page) setPage(mapped.page);
            if (mapped.total !== total) setTotal(mapped.total);
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    }, [assigned, shippingLineId, page, pageSize]);

    useEffect(() => {
        if (autoload) void load();
    }, [autoload, load]);

    const refresh = useCallback(async () => {
        await load();
    }, [load]);

    const createAgent = useCallback(async (dto: CreateAgentDto) => {
        const created = await AgentsService.create(dto);
        const mapped = mapAgentFromApi(created as any);
        setAgents((prev) => [mapped, ...prev]);
        setTotal((t) => t + 1);
        return mapped;
    }, []);

    const updateAgent = useCallback(async (id: string, dto: UpdateAgentDto) => {
        const updated = await AgentsService.update(id, dto);
        const mapped = mapAgentFromApi(updated as any);
        setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...mapped } : a)));
        return mapped;
    }, []);

    const removeAgents = useCallback(async (ids: string[]) => {
        const res = await AgentsService.removeAgents(ids);
        if (res?.success) {
            setAgents((prev) => prev.filter((a) => !ids.includes(a.id)));
            setTotal((t) => Math.max(0, t - (res.removed ?? ids.length)));
        }
        return res;
    }, []);

    const getAgent = useCallback(async (id: string) => {
        const data = await AgentsService.findOne(id);
        return mapAgentFromApi(data as any);
    }, []);

    return useMemo(
        () => ({
            agents,
            isLoading,
            error,
            page,
            pageSize,
            total,
            assigned,
            shippingLineId,

            refresh,
            setPage,
            setPageSize,
            setAssigned,
            setShippingLineId,

            createAgent,
            updateAgent,
            removeAgents,
            getAgent,
        }),
        [
            agents,
            isLoading,
            error,
            page,
            pageSize,
            total,
            assigned,
            shippingLineId,
            refresh,
            createAgent,
            updateAgent,
            removeAgents,
            getAgent,
        ],
    );
}
