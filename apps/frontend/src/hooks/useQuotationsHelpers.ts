/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ShippingLine } from "../utils/types/shipping.type";
import type { Company } from "../utils/types/company.type";
import { QuotationsService } from "../services/quotations.service";

export type QuotationAgentHelper = {
    _id: string;
    name: string;
    shippingLineId: string;
};

export type QuotationClientHelper = {
    _id: string;
    clientName: string;
};

type UseQuotationHelpersOptions = {
    autoload?: boolean;
};

export type UseQuotationHelpersReturn = {
    shippingLines: Pick<ShippingLine, "_id" | "name">[];
    agents: QuotationAgentHelper[];
    company: Company | null;
    clients: QuotationClientHelper[];
    isLoading: boolean;
    error: unknown;
    refresh: () => Promise<void>;
    loadShippingLines: () => Promise<void>;
    loadAgents: () => Promise<void>;
    loadCompany: () => Promise<void>;
    loadClients: () => Promise<void>;
};

export function useQuotationHelpers(
    opts: UseQuotationHelpersOptions = {}
): UseQuotationHelpersReturn {
    const { autoload = true } = opts;

    const [shippingLines, setShippingLines] = useState<
        Pick<ShippingLine, "_id" | "name">[]
    >([]);
    const [agents, setAgents] = useState<QuotationAgentHelper[]>([]);
    const [company, setCompany] = useState<Company | null>(null);
    const [clients, setClients] = useState<QuotationClientHelper[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(!!autoload);
    const [error, setError] = useState<unknown>(null);

    const loadShippingLines = useCallback(async () => {
        try {
            const data = await QuotationsService.getShippingLinesHelper();
            setShippingLines(data ?? []);
        } catch (e) {
            setError(e);
        }
    }, []);

    const loadAgents = useCallback(async () => {
        try {
            const data = await QuotationsService.getAgentsHelper();
            setAgents(data ?? []);
        } catch (e) {
            setError(e);
        }
    }, []);

    const loadCompany = useCallback(async () => {
        try {
            const data = await QuotationsService.getCompanyHelper();
            setCompany(data ?? null);
        } catch (e) {
            setError(e);
        }
    }, []);

    const loadClients = useCallback(async () => {
        try {
            const data = await QuotationsService.getClientsHelper();
            setClients(data ?? []);
        } catch (e) {
            setError(e);
        }
    }, []);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            await Promise.all([
                loadShippingLines(),
                loadAgents(),
                loadCompany(),
                loadClients(),
            ]);
        } finally {
            setIsLoading(false);
        }
    }, [loadShippingLines, loadAgents, loadCompany, loadClients]);

    useEffect(() => {
        if (autoload) void refresh();
    }, [autoload, refresh]);

    return useMemo(
        () => ({
            shippingLines,
            agents,
            company,
            clients,
            isLoading,
            error,
            refresh,
            loadShippingLines,
            loadAgents,
            loadCompany,
            loadClients,
        }),
        [
            shippingLines,
            agents,
            company,
            clients,
            isLoading,
            error,
            refresh,
            loadShippingLines,
            loadAgents,
            loadCompany,
            loadClients,
        ]
    );
}
