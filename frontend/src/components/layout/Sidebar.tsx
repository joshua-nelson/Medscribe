'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const primaryNavItems = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    ),
  },
  {
    href: '/encounters/new',
    label: 'Transcribe',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 7h16M4 12h16M4 17h10"
      />
    ),
  },
  {
    href: '#',
    label: 'Settings',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M10.5 6h3m-8 6h13m-10 6h7"
      />
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="relative hidden min-h-[calc(100vh-74px)] w-[272px] border-r border-[var(--lux-border-subtle)] bg-[var(--lux-bg-elevated)] lg:flex lg:flex-col">
      <nav className="flex-1 space-y-1 p-4">
        {primaryNavItems.map((item) => {
          const isActive = item.label === 'Settings' ? false : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 font-body text-sm leading-none transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--lux-brand-primary-soft)] text-[var(--lux-brand-primary-strong)]'
                  : 'text-[var(--lux-text-secondary)] hover:bg-white hover:text-[var(--lux-text-primary)]'
              }`}
            >
              <svg
                className={`h-[18px] w-[18px] transition-transform duration-200 ${
                  isActive
                    ? 'text-[var(--lux-brand-primary-strong)]'
                    : 'text-[var(--lux-text-muted)] group-hover:text-[var(--lux-text-primary)]'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {item.icon}
              </svg>
              <span className="font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--lux-border-subtle)] px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-body text-sm font-semibold uppercase tracking-[0.16em] text-[var(--lux-text-muted)]">
            Note Groups
          </p>
          <button className="font-body text-xl text-[var(--lux-text-muted)] transition hover:text-[var(--lux-text-primary)]">
            +
          </button>
        </div>
        <div className="space-y-1.5">
          {['Encounter Notes', 'SOAP Drafts', 'Archived Visits'].map((name) => (
            <div
              key={name}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 font-body text-sm text-[var(--lux-text-secondary)]"
            >
              <span className="h-2.5 w-2.5 rounded-sm bg-[var(--lux-border-strong)]" />
              <span className="truncate">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
