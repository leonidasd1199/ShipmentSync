import { useCallback, useEffect, useState } from "react";
import type { OfficeUser } from "../utils/types/office.type";
import { CompaniesService } from "../services/company.service";

type UseuseCompanyOptions = {
    companyId?: string | null;
    autoload?: boolean;
};

type UseuseCompanyReturn = {
    users: OfficeUser[];
    isLoading: boolean;
    error: unknown;
    refresh: () => Promise<void>;
    getCompanyUsers: (companyId: string) => Promise<OfficeUser[]>;
    setUsers: React.Dispatch<React.SetStateAction<OfficeUser[]>>;
};

export function useCompany(options: UseuseCompanyOptions = {}): UseuseCompanyReturn {
    const { companyId = null, autoload = true } = options;

    const [users, setUsers] = useState<OfficeUser[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(!!autoload);
    const [error, setError] = useState<unknown>(null);

    const getCompanyUsers = useCallback(async (id: string) => {
        const data = await CompaniesService.getCompanyUsers(id);
        return data ?? [];
    }, []);

    const refresh = useCallback(async () => {
        if (!companyId) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await getCompanyUsers(companyId);
            setUsers(data ?? []);
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    }, [companyId, getCompanyUsers]);

    useEffect(() => {
        if (autoload && companyId) {
            void refresh();
        } else {
            setIsLoading(false);
        }
    }, [autoload, companyId, refresh]);

    return {
        users,
        isLoading,
        error,
        refresh,
        getCompanyUsers,
        setUsers,
    };
}
