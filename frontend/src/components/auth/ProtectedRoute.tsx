'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { SoundWave } from './SoundWave';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--lux-bg-canvas)] px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--lux-brand-primary)] shadow-[var(--lux-shadow-brand)] sm:h-14 sm:w-14">
          <SoundWave barCount={5} color="bg-white" className="h-[18px] sm:h-5" />
        </div>
        <p className="animate-pulse-soft font-body text-sm font-semibold text-[var(--lux-text-secondary)] sm:text-base">
          Loading...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
