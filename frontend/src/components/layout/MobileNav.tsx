'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { primaryNavItems } from '@/components/layout/Sidebar';

const mobileItems = primaryNavItems.filter((item) => item.label !== 'Settings');

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--lux-border-subtle)] bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-sm lg:hidden">
      <ul className="grid grid-cols-3 gap-1">
        {mobileItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-[var(--lux-brand-primary-soft)] text-[var(--lux-brand-primary-strong)]'
                    : 'text-[var(--lux-text-muted)]'
                }`}
              >
                <svg
                  className="h-[18px] w-[18px]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {item.icon}
                </svg>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
