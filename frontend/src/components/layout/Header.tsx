'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SoundWave } from '@/components/auth/SoundWave';

export function Header() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <header className="h-18 bg-white/80 backdrop-blur-md border-b border-warm-300 sticky top-0 z-40">
      <div className="h-full flex items-center justify-between px-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-md shadow-primary-500/20 flex items-center justify-center">
            <SoundWave barCount={3} color="bg-white" className="h-4" />
          </div>
          <span className="font-display text-xl font-semibold text-slate-850 tracking-tight">
            MedScribe
          </span>
        </div>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-3 hover:bg-warm-100 rounded-xl px-3 py-2 transition-colors duration-200"
          >
            <div className="w-9 h-9 bg-gradient-to-br from-amber-accent/20 to-amber-accent/10 border border-amber-accent/30 rounded-xl flex items-center justify-center">
              <span className="text-amber-accent font-display font-semibold text-sm">
                {initials}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-slate-850">{user?.name}</p>
              <p className="text-xs text-slate-850/50">{user?.specialty || 'Provider'}</p>
            </div>
            <svg
              className={`w-4 h-4 text-slate-850/40 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 glass-card rounded-2xl shadow-xl shadow-slate-900/10 py-2 animate-fade-in origin-top-right">
              <div className="px-4 py-3 border-b border-warm-300">
                <p className="font-medium text-slate-850">{user?.name}</p>
                <p className="text-sm text-slate-850/50 truncate">{user?.email}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-850/70 hover:bg-warm-100 hover:text-slate-850 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
