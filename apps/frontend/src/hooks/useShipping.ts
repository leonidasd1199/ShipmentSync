/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ShippingLine,
  CreateShippingDto,
  UpdateShippingDto,
} from "../utils/types/shipping.type";
import { ShippingsService } from "../services/shipping.service";

type UseShippingOptions = {
  autoload?: boolean;
};

type UseShippingReturn = {
  shippings: ShippingLine[];
  isLoading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
  createShipping: (dto: CreateShippingDto) => Promise<ShippingLine>;
  updateShipping: (id: string, dto: UpdateShippingDto) => Promise<ShippingLine>;
  replaceShipping: (id: string, dto: UpdateShippingDto) => Promise<ShippingLine>;
  deleteShipping: (id: string) => Promise<void>;
  getShipping: (id: string) => Promise<ShippingLine>;
  addAgents: (shippingLineId: string, agentIds: string[]) => Promise<ShippingLine>;
  removeAgents: (shippingLineId: string, agentIds?: string[]) => Promise<ShippingLine>;
};

export const mapShippingFromApi = (s: any): ShippingLine => ({
  _id: s._id ?? s.id,
  name: s.name,
  legalName: s.legalName,
  email: s.email,
  phone: s.phone,
  website: s.website,
  notes: s.notes,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
  shippingModes: s.shippingModes,
  agents: Array.isArray(s.agents)
    ? s.agents.map((a: any) => ({
        _id: a._id ?? a.id,
        name: a.name,
        email: a.email,
        phone: a.phone,
        country: a.country,
      }))
    : undefined,
});

export function useShipping(opts: UseShippingOptions = {}): UseShippingReturn {
  const { autoload = true } = opts;

  const [shippings, setShippings] = useState<ShippingLine[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(!!autoload);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ShippingsService.findAll();
      setShippings((data ?? []).map(mapShippingFromApi));
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoload) void load();
  }, [autoload, load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const createShipping = useCallback(async (dto: CreateShippingDto) => {
    const created = await ShippingsService.create(dto);
    const mapped = mapShippingFromApi(created as any);
    setShippings((prev) => [mapped, ...prev]);
    return mapped;
  }, []);

  const updateShipping = useCallback(
    async (id: string, dto: UpdateShippingDto) => {
      const updated = await ShippingsService.update(id, dto);
      const mapped = mapShippingFromApi(updated as any);
      setShippings((prev) =>
        prev.map((s) => (s._id === id ? { ...s, ...mapped } : s)),
      );
      return mapped;
    },
    [],
  );

  const replaceShipping = useCallback(
    async (id: string, dto: UpdateShippingDto) => {
      const replaced = await ShippingsService.replace(id, dto);
      const mapped = mapShippingFromApi(replaced as any);
      setShippings((prev) =>
        prev.map((s) => (s._id === id ? { ...s, ...mapped } : s)),
      );
      return mapped;
    },
    [],
  );

  const deleteShipping = useCallback(async (id: string) => {
    await ShippingsService.remove(id);
    setShippings((prev) => prev.filter((s) => s._id !== id));
  }, []);

  const getShipping = useCallback(async (id: string) => {
    const data = await ShippingsService.findOne(id);
    return mapShippingFromApi(data as any);
  }, []);

  const addAgents = useCallback(
    async (shippingLineId: string, agentIds: string[]) => {
      await ShippingsService.addAgents(shippingLineId, agentIds);
      const updated = await ShippingsService.findOne(shippingLineId);
      const mapped = mapShippingFromApi(updated as any);

      setShippings((prev) => {
        const exists = prev.some((s) => s._id === shippingLineId);
        if (!exists) return [mapped, ...prev];
        return prev.map((s) => (s._id === shippingLineId ? mapped : s));
      });

      return mapped;
    },
    [],
  );

  const removeAgents = useCallback(
    async (shippingLineId: string, agentIds?: string[]) => {
      await ShippingsService.removeAgents(shippingLineId, agentIds);
      const updated = await ShippingsService.findOne(shippingLineId);
      const mapped = mapShippingFromApi(updated as any);

      setShippings((prev) => {
        const exists = prev.some((s) => s._id === shippingLineId);
        if (!exists) return [mapped, ...prev];
        return prev.map((s) => (s._id === shippingLineId ? mapped : s));
      });

      return mapped;
    },
    [],
  );

  return useMemo(
    () => ({
      shippings,
      isLoading,
      error,
      refresh,
      createShipping,
      updateShipping,
      replaceShipping,
      deleteShipping,
      getShipping,
      addAgents,
      removeAgents,
    }),
    [
      shippings,
      isLoading,
      error,
      refresh,
      createShipping,
      updateShipping,
      replaceShipping,
      deleteShipping,
      getShipping,
      addAgents,
      removeAgents,
    ],
  );
}
