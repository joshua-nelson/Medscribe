'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { SessionTimeoutModal } from '@/components/auth/SessionTimeoutModal';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { showWarning, secondsRemaining, stayLoggedIn, logout } = useSessionTimeout();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[var(--lux-bg-canvas)]">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 px-3 py-4 pb-24 sm:px-4 sm:py-5 sm:pb-24 lg:px-8 lg:py-7 lg:pb-7">
            {children}
          </main>
        </div>
        <MobileNav />
      </div>

      {showWarning && (
        <SessionTimeoutModal
          secondsRemaining={secondsRemaining}
          onStayLoggedIn={stayLoggedIn}
          onLogout={logout}
        />
      )}
    </ProtectedRoute>
  );
}
