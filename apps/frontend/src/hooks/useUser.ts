/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { getMyProfile } from "../services/auth.service";
import type { User, UpdateMyProfileDto, UpdateUserDto } from "../utils/types/user.type";
import UsersService from "../services/user.service";

type UseUserOptions = {
  autoload?: boolean;
};

type UseUserReturn = {
  user: User | null;
  isLoading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
  updateMyProfile: (payload: UpdateMyProfileDto) => Promise<User | null>;
  updateUser: (userId: string, payload: UpdateUserDto) => Promise<User | null>;
};

export function useUser(opts: UseUserOptions = {}): UseUserReturn {
  const { autoload = true } = opts;

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!autoload);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMyProfile();
      setUser(data?.user ?? null);
    } catch (e) {
      setError(e);
      setUser(null);
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

  const updateMyProfile = useCallback(
    async (payload: UpdateMyProfileDto) => {
      try {
        const updated = await UsersService.updateMyProfile(payload);
        setUser((prev) => (prev ? { ...prev, ...updated.user } : updated.user));
        return updated.user ?? null;
      } catch (e) {
        setError(e);
        throw e;
      }
    },
    []
  );

  const updateUser = useCallback(
    async (userId: string, payload: UpdateUserDto) => {
      try {
        const updated = await UsersService.updateUser(userId, payload);
        return updated.user ?? null;
      } catch (e) {
        setError(e);
        throw e;
      }
    },
    []
  );

  return useMemo(
    () => ({
      user,
      isLoading,
      error,
      refresh,
      updateMyProfile,
      updateUser,
    }),
    [user, isLoading, error, refresh, updateMyProfile, updateUser]
  );
}
