'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useAuthController } from '@/core/auth/useAuthController';
import { useAuthStore } from '@/stores/authStore';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { checkAuth } = useAuthController();
  const { isAuthenticated, setLoading } = useAuthStore();
  const hasCheckedAuthRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // Skip auth check on public routes (login page)
    if (pathname === '/login') {
      setLoading(false);
      return;
    }

    if (isAuthenticated || hasCheckedAuthRef.current) {
      return;
    }

    hasCheckedAuthRef.current = true;

    void checkAuth().then((success) => {
      if (!isMounted) {
        return;
      }

      if (!success) {
        router.replace('/login');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [pathname, checkAuth, isAuthenticated, router, setLoading]);

  return <>{children}</>;
}
