'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import api, { setAccessToken } from '@/lib/api';
import { AuthResponse } from '@/types';

export function useAuth() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, setAuth, clearAuth, setLoading } = useAuthStore();

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<AuthResponse>('/auth/login', { email, password });
    const { accessToken, ...userData } = response.data;
    setAccessToken(accessToken);
    setAuth(accessToken, userData);
    router.push('/');
  }, [setAuth, router]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      clearAuth();
      router.push('/login');
    }
  }, [clearAuth, router]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.post<AuthResponse>('/auth/refresh');
      const { accessToken, ...userData } = response.data;
      setAccessToken(accessToken);
      setAuth(accessToken, userData);
      return true;
    } catch {
      clearAuth();
      return false;
    }
  }, [setAuth, clearAuth, setLoading]);

  const checkAuth = useCallback(async () => {
    const success = await refresh();
    if (!success && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      router.push('/login');
    }
  }, [refresh, router]);

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
