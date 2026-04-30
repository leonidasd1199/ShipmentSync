/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { PermissionsService } from "../services/permissions.service";
import type { User } from "../utils/types/user.type";

export type PermissionItem = { id: string; code: string; description: string };

type UsePermissionsOptions = {
    companyId?: string | null;
    autoload?: boolean;
};

type UsePermissionsReturn = {
    permissions: PermissionItem[];
    users: Array<User & { office_disabled?: boolean }>;
    isLoading: boolean;
    error: unknown;

    refresh: () => Promise<void>;

    assignPermissions: (userId: string, permissionCodes: string[]) => Promise<any>;
    removePermissions: (userId: string, permissionCodes: string[]) => Promise<any>;

    fetchAllPermissions: () => Promise<void>;
    fetchCompanyUsers: () => Promise<void>;
};

export function usePermissions(opts: UsePermissionsOptions = {}): UsePermissionsReturn {
    const { companyId = null, autoload = true } = opts;

    const [permissions, setPermissions] = useState<PermissionItem[]>([]);
    const [users, setUsers] = useState<Array<User & { office_disabled?: boolean }>>([]);
    const [isLoading, setIsLoading] = useState<boolean>(!!autoload);
    const [error, setError] = useState<unknown>(null);

    const fetchAllPermissions = useCallback(async () => {
        const { permissions } = await PermissionsService.getAll();
        setPermissions(permissions ?? []);
    }, []);

    const fetchCompanyUsers = useCallback(async () => {
        if (!companyId) return;
        const { users } = await PermissionsService.getCompanyUsersWithPermissions(companyId);
        setUsers(users ?? []);
    }, [companyId]);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            await fetchAllPermissions();
            if (companyId) {
                await fetchCompanyUsers();
            }
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    }, [companyId, fetchAllPermissions, fetchCompanyUsers]);

    useEffect(() => {
        if (autoload) {
            void load();
        }
    }, [autoload, load]);

    const refresh = useCallback(async () => {
        await load();
    }, [load]);

    const assignPermissions = useCallback(
        async (userId: string, permissionCodes: string[]) => {
            const res = await PermissionsService.assignToUser(userId, permissionCodes);
            setUsers((prev) =>
                prev.map((u) =>
                    (u._id === userId)
                        ? {
                            ...u,
                            permissions: Array.from(
                                new Set([...(u.permissions ?? []), ...permissionCodes]),
                            ),
                        }
                        : u
                )
            );

            return res;
        },
        []
    );

    const removePermissions = useCallback(
        async (userId: string, permissionCodes: string[]) => {
            const res = await PermissionsService.removeFromUser(userId, permissionCodes);

            // Actualización local: quitar los códigos removidos
            setUsers((prev) =>
                prev.map((u) =>
                    (u._id === userId)
                        ? {
                            ...u,
                            permissions: (u.permissions ?? []).filter((c) => !permissionCodes.includes(c)),
                        }
                        : u
                )
            );

            return res;
        },
        []
    );

    return useMemo(
        () => ({
            permissions,
            users,
            isLoading,
            error,
            refresh,
            assignPermissions,
            removePermissions,
            fetchAllPermissions,
            fetchCompanyUsers,
        }),
        [
            permissions,
            users,
            isLoading,
            error,
            refresh,
            assignPermissions,
            removePermissions,
            fetchAllPermissions,
            fetchCompanyUsers,
        ]
    );
}
