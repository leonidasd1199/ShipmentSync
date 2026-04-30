/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { OfficesService } from "../services/office.service";
import type { Office, CreateOfficeDto, UpdateOfficeDto, OfficeUser } from "../utils/types/office.type";
import type { AssignNewUserDto } from "../utils/types/user.type";

type UseOfficesOptions = {
  companyId?: string | null;
  autoload?: boolean;
};

type UseOfficesReturn = {
  offices: Office[];
  isLoading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
  createOffice: (dto: CreateOfficeDto) => Promise<Office>;
  updateOffice: (id: string, dto: UpdateOfficeDto) => Promise<Office>;
  replaceOffice: (id: string, dto: UpdateOfficeDto) => Promise<Office>;
  deleteOffice: (id: string) => Promise<void>;
  getOffice: (id: string) => Promise<Office>;
  assignUsers: (officeId: string, userIds: string[]) => Promise<void>;
  removeUsers: (officeId: string, userId: string) => Promise<void>;
  getOfficeUsers: (officeId: string) => Promise<OfficeUser[]>;
  getDisabledUsers: (officeId: string) => Promise<OfficeUser[]>;
  assignNewUser: (officeId: string, user: AssignNewUserDto) => Promise<any>;
};

export const mapOfficeFromApi = (o: any): Office => ({
  id: o._id,
  name: o.name,
  email: o.email,
  address: o.address,
  phone: o.phone,
  companyId: o.company?._id ?? o.companyId ?? "",
  description: o.description,
  type: o.type,
  invoicing: o.invoicing
    ? {
        cai: o.invoicing.cai,
        ein: o.invoicing.ein ?? "",
        email: o.invoicing.email ?? "",
        address: {
          street: o.invoicing.address?.street ?? "",
          city: o.invoicing.address?.city ?? "",
          state: o.invoicing.address?.state ?? "",
          zipCode: o.invoicing.address?.zipCode ?? "",
          country: o.invoicing.address?.country ?? "",
        },
        invoiceRange: {
          from: o.invoicing.invoiceRange?.from ?? 1,
          to: o.invoicing.invoiceRange?.to ?? 1,
        },
        lastUsedInvoiceNumber: o.invoicing.lastUsedInvoiceNumber,
      }
    : undefined,
});

export function useOffices(opts: UseOfficesOptions = {}): UseOfficesReturn {
  const { companyId = null, autoload = true } = opts;

  const [offices, setOffices] = useState<Office[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(!!autoload);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = companyId
        ? await OfficesService.getByCompany(companyId)
        : await OfficesService.findAll();
      setOffices((data ?? []).map(mapOfficeFromApi));
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (autoload) void load();
  }, [autoload, load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const createOffice = useCallback(
    async (dto: CreateOfficeDto) => {
      const created = await OfficesService.create(dto);
      if (!companyId || companyId === created.companyId) {
        setOffices((prev) => [created, ...prev]);
      }
      return created;
    },
    [companyId]
  );

  const updateOffice = useCallback(async (id: string, dto: UpdateOfficeDto) => {
    const updated = await OfficesService.update(id, dto);
    setOffices((prev) => prev.map((o) => (o.id === id ? { ...o, ...updated } : o)));
    return updated;
  }, []);

  const replaceOffice = useCallback(async (id: string, dto: UpdateOfficeDto) => {
    const replaced = await OfficesService.replace(id, dto);
    setOffices((prev) => prev.map((o) => (o.id === id ? { ...o, ...replaced } : o)));
    return replaced;
  }, []);

  const deleteOffice = useCallback(async (id: string) => {
    await OfficesService.remove(id);
    setOffices((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const getOffice = useCallback(async (id: string) => {
    return OfficesService.getOffice(id);
  }, []);

  const assignUsers = useCallback(async (officeId: string, userIds: string[]) => {
    if (!userIds?.length) return;
    await OfficesService.assignUsers(officeId, { userIds });
  }, []);

  const removeUsers = useCallback(async (officeId: string, userId: string) => {
    await OfficesService.removeUsers(officeId, userId);
  }, []);

  const getOfficeUsers = useCallback(async (officeId: string) => {
    return OfficesService.getOfficeUsers(officeId);
  }, []);

  const getDisabledUsers = useCallback(async (officeId: string) => {
    return OfficesService.getDisabledUsers(officeId);
  }, []);

  const assignNewUser = useCallback(async (officeId: string, user: AssignNewUserDto) => {
    return OfficesService.assignNewUser(officeId, user);
  }, []);

  return useMemo(
    () => ({
      offices,
      isLoading,
      error,
      refresh,
      createOffice,
      updateOffice,
      replaceOffice,
      deleteOffice,
      getOffice,
      assignUsers,
      removeUsers,
      getOfficeUsers,
      getDisabledUsers,
      assignNewUser,
    }),
    [
      offices,
      isLoading,
      error,
      refresh,
      createOffice,
      updateOffice,
      replaceOffice,
      deleteOffice,
      getOffice,
      assignUsers,
      removeUsers,
      getOfficeUsers,
      getDisabledUsers,
      assignNewUser,
    ]
  );
}
