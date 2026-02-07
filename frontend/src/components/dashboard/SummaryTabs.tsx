'use client';

import Link from 'next/link';

type SummaryTabsProps = {
  active: 'summary' | 'transcribe' | 'chat';
};

export function SummaryTabs({ active }: SummaryTabsProps) {
  return (
    <div className="inline-flex rounded-xl border border-[var(--lux-border-subtle)] bg-white p-1.5">
      <Link
        href="/encounters/new"
        className={`rounded-lg px-3 py-2 font-body text-xs font-semibold uppercase tracking-[0.12em] transition sm:px-4 ${
          active === 'transcribe'
            ? 'bg-[var(--lux-brand-primary-soft)] text-[var(--lux-brand-primary-strong)]'
            : 'text-[var(--lux-text-secondary)] hover:bg-[var(--lux-bg-canvas)] hover:text-[var(--lux-text-primary)]'
        }`}
      >
        Transcribe
      </Link>
      <Link
        href="/"
        className={`rounded-lg px-3 py-2 font-body text-xs font-semibold uppercase tracking-[0.12em] transition sm:px-4 ${
          active === 'summary'
            ? 'bg-[var(--lux-brand-primary-soft)] text-[var(--lux-brand-primary-strong)]'
            : 'text-[var(--lux-text-secondary)] hover:bg-[var(--lux-bg-canvas)] hover:text-[var(--lux-text-primary)]'
        }`}
      >
        Home
      </Link>
      <Link
        href="/encounters"
        className={`rounded-lg px-3 py-2 font-body text-xs font-semibold uppercase tracking-[0.12em] transition sm:px-4 ${
          active === 'chat'
            ? 'bg-[var(--lux-brand-primary-soft)] text-[var(--lux-brand-primary-strong)]'
            : 'text-[var(--lux-text-secondary)] hover:bg-[var(--lux-bg-canvas)] hover:text-[var(--lux-text-primary)]'
        }`}
      >
        Encounters
      </Link>
    </div>
  );
}
