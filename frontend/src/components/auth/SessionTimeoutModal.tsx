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
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="glass-card rounded-3xl p-8 max-w-md w-full shadow-2xl shadow-slate-900/20 animate-slide-up">
        {/* Warning Icon */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-amber-accent/20 to-amber-accent/10 rounded-2xl flex items-center justify-center border border-amber-accent/30">
            <svg className="w-7 h-7 text-amber-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-850">Session Expiring</h2>
            <p className="text-slate-850/60 text-sm">Due to inactivity</p>
          </div>
        </div>

        {/* Countdown */}
        <div className="text-center py-6 mb-6 bg-warm-100 rounded-2xl border border-warm-300">
          <div className="font-display text-5xl font-bold text-slate-850 tracking-tight tabular-nums">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          <p className="text-slate-850/50 text-sm mt-2">until automatic logout</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onLogout}
            className="flex-1 px-5 py-3.5 border border-warm-300 rounded-xl text-slate-850/70 font-medium hover:bg-warm-100 hover:border-warm-300 transition-all duration-200"
          >
            Log out now
          </button>
          <button
            onClick={onStayLoggedIn}
            className="flex-1 px-5 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-medium shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 transition-all duration-200"
          >
            Stay logged in
          </button>
        </div>
      </div>
    </div>
  );
}
