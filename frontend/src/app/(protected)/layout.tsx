'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { SessionTimeoutModal } from '@/components/auth/SessionTimeoutModal';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { showWarning, secondsRemaining, stayLoggedIn, logout } = useSessionTimeout();

  return (
    <ProtectedRoute>
      <div className="min-h-screen gradient-mesh">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6 lg:p-8">
            {children}
          </main>
        </div>
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
