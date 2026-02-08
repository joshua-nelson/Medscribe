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

  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--lux-border-subtle)] bg-[var(--lux-bg-elevated)]/95 backdrop-blur-sm">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-5 lg:h-[74px] lg:gap-5 lg:px-8">
        <div className="flex items-center gap-2.5 lg:w-[292px]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--lux-brand-primary)] text-white shadow-[0_8px_18px_rgba(110,86,207,0.3)] lg:h-10 lg:w-10">
            <SoundWave barCount={3} color="bg-white" className="h-4" />
          </div>
          <span className="font-display text-2xl tracking-tight text-[var(--lux-text-primary)] lg:text-[34px]">
            MedScribe
          </span>
        </div>

        <div className="relative hidden flex-1 md:block">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--lux-text-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 6.5 6.5a7.5 7.5 0 0 0 10.6 10.6z"
            />
          </svg>
          <input
            type="text"
            aria-label="Search"
            placeholder="Search encounters"
            className="h-11 w-full rounded-xl border border-[var(--lux-border-subtle)] bg-white pl-10 pr-4 font-body text-base text-[var(--lux-text-primary)] outline-none placeholder:text-[var(--lux-text-muted)] focus:border-[var(--lux-brand-primary)] focus:ring-2 focus:ring-[var(--lux-brand-primary)]/20"
          />
        </div>

        <button className="hidden h-10 items-center gap-2 rounded-xl bg-[var(--lux-brand-primary)] px-4 font-body text-sm font-semibold text-white shadow-[0_10px_24px_rgba(110,86,207,0.32)] transition hover:bg-[var(--lux-brand-primary-strong)] lg:inline-flex">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Start Encounter
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 rounded-full border border-[var(--lux-border-subtle)] bg-white p-1.5 transition hover:border-[var(--lux-border-strong)]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--lux-brand-primary-soft)]">
              <span className="font-body text-sm font-semibold text-[var(--lux-brand-primary-strong)]">
                {initials}
              </span>
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-[var(--lux-border-subtle)] bg-white py-1.5 shadow-[0_16px_38px_rgba(23,21,31,0.14)]">
              <div className="min-w-0 border-b border-[var(--lux-border-subtle)] px-3.5 py-2.5">
                <p className="truncate font-body text-sm font-semibold text-[var(--lux-text-primary)]">
                  {user?.name}
                </p>
                <p className="mt-0.5 truncate font-body text-xs text-[var(--lux-text-muted)]">
                  {user?.email}
                </p>
              </div>
              <div className="pt-1">
                <button
                  onClick={logout}
                  className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2.5 rounded-lg px-3.5 py-2 font-body text-sm text-[var(--lux-text-secondary)] transition hover:bg-[var(--lux-bg-canvas)] hover:text-red-600"
                  style={{ width: 'calc(100% - 0.625rem)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
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
