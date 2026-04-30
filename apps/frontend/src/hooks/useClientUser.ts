/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientUserService, type ClientPriceListItem } from "../services/client.user.service";
import type { QuotationCardRow, QuotationCardItem } from "../configs/quotationCard.config";

type UseClientUserOptions = {
    autoload?: boolean;
    priceListQuery?: { dateFrom?: string; dateTo?: string };
};

type UseClientUserReturn = {
    priceList: QuotationCardRow[];
    shipments: any[];
    isLoading: boolean;
    error: unknown;
    refreshPriceList: () => Promise<void>;
    refreshShipments: () => Promise<void>;
    loadAll: () => Promise<void>;
};

/**
 * Map backend delivery (GET /clients/price-list) to the shape expected by QuotationCard.
 * Field names must match quotationColumnConfig / quotationItemsConfig in quotationCard.config.
 */
function mapDeliveryToQuotationCard(delivery: ClientPriceListItem): QuotationCardRow {
    const snap = delivery.quotationSnapshot ?? {};
    const rawItems = (Array.isArray(snap.legacyItems) && snap.legacyItems.length > 0)
        ? snap.legacyItems
        : (Array.isArray(snap.items) && snap.items.length > 0)
            ? snap.items
            : (Array.isArray(snap.lineItems) ? snap.lineItems : []);
    const items: QuotationCardItem[] = rawItems.map((i: any) => ({
        description: i.description ?? i.label ?? "—",
        amount: typeof i.price === "number" ? i.price : (typeof i.amount === "number" ? i.amount : 0),
        currency: i.currency ?? "USD",
    }));
    const sentAt = delivery.sentAt ? new Date(delivery.sentAt) : null;
    const dateStr = sentAt ? sentAt.toISOString().slice(0, 10) : "";
    const rawValidUntil = snap.validUntil;
    const validUntil =
        rawValidUntil == null
            ? ""
            : typeof rawValidUntil === "string"
              ? rawValidUntil.slice(0, 10)
              : typeof rawValidUntil === "number" || rawValidUntil instanceof Date
                ? new Date(rawValidUntil).toISOString().slice(0, 10)
                : "";
    return {
        id: (delivery as any)._id?.toString?.() ?? (delivery as any)._id ?? "",
        quoteNumber: (snap.quoteNumber as string) ?? "—",
        origin: (snap as any).origin ?? (snap as any).portOfOrigin?.name ?? "—",
        destination: (snap as any).destination ?? (snap as any).portOfDestination?.name ?? "—",
        date: dateStr,
        validUntil,
        items,
    };
}

export function useClientUser(
    opts: UseClientUserOptions = {}
): UseClientUserReturn {

    const { autoload = true, priceListQuery } = opts;

    const [priceList, setPriceList] = useState<QuotationCardRow[]>([]);
    const [shipments, setShipments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(!!autoload);
    const [error, setError] = useState<unknown>(null);

    const loadPriceList = useCallback(async () => {
        setError(null);
        try {
            const data = await ClientUserService.getPriceList(priceListQuery);
            setPriceList(data.map(mapDeliveryToQuotationCard));
        } catch (e) {
            setError(e);
        }
    }, [priceListQuery]);

    const loadShipments = useCallback(async () => {

        setError(null);

        try {

            const data = await ClientUserService.getShipments();
            setShipments(data ?? []);

        } catch (e) {

            setError(e);

        }

    }, []);

    const loadAll = useCallback(async () => {

        setIsLoading(true);

        try {

            await Promise.all([
                loadPriceList(),
                loadShipments()
            ]);

        } finally {

            setIsLoading(false);

        }

    }, [loadPriceList, loadShipments]);

    useEffect(() => {

        if (autoload) {
            void loadAll();
        }

    }, [autoload, loadAll]);

    const refreshPriceList = useCallback(async () => {
        await loadPriceList();
    }, [loadPriceList]);

    const refreshShipments = useCallback(async () => {
        await loadShipments();
    }, [loadShipments]);

    return useMemo(
        () => ({
            priceList,
            shipments,
            isLoading,
            error,
            refreshPriceList,
            refreshShipments,
            loadAll,
        }),
        [
            priceList,
            shipments,
            isLoading,
            error,
            refreshPriceList,
            refreshShipments,
            loadAll,
        ]
    );
}