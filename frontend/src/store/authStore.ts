import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ServiceUserData } from '@/api';

interface AuthState {
  user: ServiceUserData | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoaded: boolean;

  setUser: (user: ServiceUserData | null) => void;
  setAccessToken: (token: string | null) => void;
  login: (user: ServiceUserData, token: string) => void;
  logout: () => void;
  clearAuth: () => void;
  markLoaded: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoaded: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setAccessToken: (token) => set({ accessToken: token }),

      login: (user, token) =>
        set({
          user,
          accessToken: token,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        }),

      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        }),

      markLoaded: () => set({ isLoaded: true }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markLoaded();
      },
    },
  ),
);
