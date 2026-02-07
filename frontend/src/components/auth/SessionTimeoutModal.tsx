'use client';

interface SessionTimeoutModalProps {
  secondsRemaining: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export function SessionTimeoutModal({
  secondsRemaining,
  onStayLoggedIn,
  onLogout,
}: SessionTimeoutModalProps) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md animate-slide-up rounded-3xl border border-[var(--lux-border-subtle)] bg-white p-6 shadow-2xl shadow-slate-900/20 sm:p-8">
        {/* Warning Icon */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50">
            <svg
              className="w-7 h-7 text-amber-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h2 className="font-body text-xl font-semibold text-slate-900">Session Expiring</h2>
            <p className="font-body text-sm text-slate-600">Due to inactivity</p>
          </div>
        </div>

        {/* Countdown */}
        <div className="mb-6 rounded-2xl border border-[var(--lux-border-subtle)] bg-[var(--lux-bg-canvas)] py-6 text-center">
          <div className="font-body text-5xl font-bold tracking-tight text-slate-900 tabular-nums">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          <p className="mt-2 font-body text-sm text-slate-500">until automatic logout</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onLogout}
            className="flex-1 rounded-xl border border-slate-200 px-5 py-3.5 font-body font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Log out now
          </button>
          <button
            onClick={onStayLoggedIn}
            className="flex-1 rounded-xl bg-[var(--lux-brand-primary)] px-5 py-3.5 font-body font-medium text-white shadow-[var(--lux-shadow-brand)] transition hover:bg-[var(--lux-brand-primary-strong)]"
          >
            Stay logged in
          </button>
        </div>
      </div>
    </div>
  );
}
