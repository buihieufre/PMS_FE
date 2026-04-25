import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { resetSocket } from '@/lib/socketManager';

interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  steps?: number;
  stepGoal?: number;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null; // For LocalStorage fallback or manual tracking
  user: User | null;
  setAuth: (accessToken: string, refreshToken: string | null, user: User) => void;
  setUser: (user: User) => void;
  updateAccessToken: (accessToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
      setUser: (user) => set({ user }),
      updateAccessToken: (accessToken) => set({ accessToken }),
      logout: () => {
        resetSocket();
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
