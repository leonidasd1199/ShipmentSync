/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import type {
  Shipment,
  CreateShipmentDto,
  UpdateShipmentDto,
  ShipmentFilters,
} from "../utils/types/shipment.type";
import { ShipmentsService } from "../services/shipments.service";

type UseShipmentsOptions = {
  autoload?: boolean;
  defaultFilters?: ShipmentFilters;
};

export function useShipments(opts: UseShipmentsOptions = {}) {
  const { autoload = true, defaultFilters = {} } = opts;

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(!!autoload);
  const [error, setError] = useState<unknown>(null);
  const [filters, setFilters] = useState<ShipmentFilters>(defaultFilters);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ShipmentsService.findAll(filters);
      setShipments(data ?? []);
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (autoload) void load();
  }, [autoload, load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const createShipment = useCallback(async (dto: CreateShipmentDto) => {
    const created = await ShipmentsService.create(dto);
    setShipments((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateShipment = useCallback(
    async (id: string, dto: UpdateShipmentDto) => {
      const updated = await ShipmentsService.update(id, dto);
      setShipments((prev) =>
        prev.map((s) => (s._id === id ? updated : s)),
      );
      return updated;
    },
    [],
  );

  const getShipment = useCallback(async (id: string) => {
    return ShipmentsService.getOne(id);
  }, []);

  const applyFilters = useCallback((partial: Partial<ShipmentFilters>) => {
    setFilters((prev: any) => ({ ...prev, ...partial }));
  }, []);

  return {
    shipments,
    isLoading,
    error,
    filters,
    setFilters,
    applyFilters,
    refresh,
    createShipment,
    updateShipment,
    getShipment,
  };
}
