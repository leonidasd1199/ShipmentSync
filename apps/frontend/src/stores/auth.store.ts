import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../utils/types/user.type'

type AuthState = {
  token: string | null
  user: User | null
  setSession: (token: string, user: User | null) => void
  setUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,

      setSession: (token, user) => set({ token, user }),

      setUser: (user) => set((state) => ({
        ...state,
        user,
      })),

      logout: () => set({ token: null, user: null }),
    }),
    { name: 'auth-store' },
  ),
)
