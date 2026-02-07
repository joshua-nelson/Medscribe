'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthController } from '@/core/auth/useAuthController';

export function useAuth() {
  const router = useRouter();
  const authController = useAuthController();

  const login = useCallback(
    async (email: string, password: string) => {
      await authController.login(email, password);
      router.push('/');
    },
    [authController, router],
  );

  const logout = useCallback(async () => {
    await authController.logout();
    router.push('/login');
  }, [authController, router]);

  const refresh = useCallback(async () => {
    return authController.refresh();
  }, [authController]);

  const checkAuth = useCallback(async () => {
    const success = await authController.checkAuth();
    if (!success && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      router.push('/login');
    }
    return success;
  }, [authController, router]);

  return {
    user: authController.user,
    isLoading: authController.isLoading,
    isAuthenticated: authController.isAuthenticated,
    login,
    logout,
    refresh,
    checkAuth,
  };
}
