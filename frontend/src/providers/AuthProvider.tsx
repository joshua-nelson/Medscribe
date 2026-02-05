'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const pathname = usePathname();
  const { checkAuth } = useAuth();
  const { setLoading } = useAuthStore();

  useEffect(() => {
    // Skip auth check on public routes (login page)
    if (pathname === '/login') {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [pathname, checkAuth, setLoading]);

  return <>{children}</>;
}
