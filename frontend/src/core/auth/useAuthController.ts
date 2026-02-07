'use client';

import { useCallback } from 'react';
import {
  clearInMemoryToken,
  loginWithPassword,
  logoutSession,
  refreshAuth,
  setInMemoryToken,
} from '@/core/auth/authService';
import { useAuthStore } from '@/stores/authStore';

export function useAuthController() {
  const { user, isLoading, isAuthenticated, setAuth, clearAuth, setLoading } = useAuthStore();

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginWithPassword(email, password);
      setInMemoryToken(result.accessToken);
      setAuth(result.accessToken, result.user);
      return result.user;
    },
    [setAuth],
  );

  const logout = useCallback(async () => {
    try {
      await logoutSession();
    } finally {
      clearInMemoryToken();
      clearAuth();
    }
  }, [clearAuth]);

  const refresh = useCallback(async () => {
    try {
      if (!isAuthenticated) {
        setLoading(true);
      }
      const result = await refreshAuth();
      setInMemoryToken(result.accessToken);
      setAuth(result.accessToken, result.user);
      return true;
    } catch {
      clearInMemoryToken();
      clearAuth();
      return false;
    }
  }, [isAuthenticated, setAuth, clearAuth, setLoading]);

  const checkAuth = useCallback(async () => {
    return refresh();
  }, [refresh]);

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refresh,
    checkAuth,
  };
}
