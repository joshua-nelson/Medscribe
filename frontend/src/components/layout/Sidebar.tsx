'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    href: '/',
    label: 'Dashboard',
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
    href: '/encounters',
    label: 'Encounters',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white/50 border-r border-warm-300 min-h-[calc(100vh-4.5rem)] hidden lg:block">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                  : 'text-slate-850/70 hover:bg-warm-100 hover:text-slate-850'
              }`}
            >
              <svg
                className={`w-5 h-5 transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {item.icon}
              </svg>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom decoration */}
      <div className="absolute bottom-6 left-4 right-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-primary-500/5 to-amber-accent/5 border border-primary-500/10">
          <p className="text-xs text-slate-850/50 text-center">
            MedScribe v0.1.0
          </p>
        </div>
      </div>
    </aside>
  );
}
