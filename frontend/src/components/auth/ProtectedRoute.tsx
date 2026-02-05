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
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-mesh flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/30 flex items-center justify-center">
          <SoundWave barCount={5} color="bg-white" className="h-5" />
        </div>
        <p className="text-slate-850/60 font-body animate-pulse-soft">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
