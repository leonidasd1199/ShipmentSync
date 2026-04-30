/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Client,
  CreateClientDto,
  UpdateClientDto,
} from "../utils/types/client.type";
import { ClientsService } from "../services/clients.service";

type UseClientsOptions = {
  autoload?: boolean;
};

type UseClientsReturn = {
  clients: Client[];
  isLoading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
  createClient: (dto: CreateClientDto) => Promise<Client>;
  updateClient: (id: string, dto: UpdateClientDto) => Promise<Client>;
  replaceClient: (id: string, dto: UpdateClientDto) => Promise<Client>;
  deleteClient: (id: string) => Promise<void>;
  getClient: (id: string) => Promise<Client>;
};

export const mapClientFromApi = (c: any): Client => ({
  id: c._id ?? c.id,
  name: c.name,
  officeId: c.office._id ?? "",
  officeName: c.office.name,
  contactPerson: c.contactPerson,
  email: c.email,
  phone: c.phone,
  address: c.address,
  taxId: c.taxId,
  invoiceInformation: c.invoiceInformation,
  isActive: c.isActive,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

export function useClients(opts: UseClientsOptions = {}): UseClientsReturn {
  const { autoload = true } = opts;

  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(!!autoload);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ClientsService.findAll();
      setClients((data ?? []).map(mapClientFromApi));
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

  const createClient = useCallback(async (dto: CreateClientDto) => {
    const created = await ClientsService.create(dto);
    const mapped = mapClientFromApi(created as any);
    setClients((prev) => [mapped, ...prev]);
    return mapped;
  }, []);

  const updateClient = useCallback(async (id: string, dto: UpdateClientDto) => {
    const updated = await ClientsService.update(id, dto);
    const mapped = mapClientFromApi(updated as any);
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...mapped } : c)));
    return mapped;
  }, []);

  const replaceClient = useCallback(async (id: string, dto: UpdateClientDto) => {
    const replaced = await ClientsService.replace(id, dto);
    const mapped = mapClientFromApi(replaced as any);
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...mapped } : c)));
    return mapped;
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    await ClientsService.remove(id);
    setClients((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const getClient = useCallback(async (id: string) => {
    const data = await ClientsService.getClient(id);
    return mapClientFromApi(data as any);
  }, []);

  return useMemo(
    () => ({
      clients,
      isLoading,
      error,
      refresh,
      createClient,
      updateClient,
      replaceClient,
      deleteClient,
      getClient,
    }),
    [
      clients,
      isLoading,
      error,
      refresh,
      createClient,
      updateClient,
      replaceClient,
      deleteClient,
      getClient,
    ]
  );
}
