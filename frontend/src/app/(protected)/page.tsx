'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { SoundWave } from '@/components/auth/SoundWave';

export default function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="max-w-5xl animate-fade-in">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-slate-850 tracking-tight">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="mt-1 text-slate-850/60">
          Ready to document patient encounters
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* New Encounter Card */}
        <Link
          href="/encounters/new"
          className="group glass-card rounded-2xl p-6 hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-300 border-2 border-transparent hover:border-primary-500/20"
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl shadow-lg shadow-primary-500/25 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <SoundWave barCount={3} color="bg-white" className="h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold text-slate-850 group-hover:text-primary-500 transition-colors">
                New Encounter
              </h2>
              <p className="mt-1 text-sm text-slate-850/60">
                Start real-time transcription for a patient visit
              </p>
            </div>
            <svg
              className="w-5 h-5 text-slate-850/30 group-hover:text-primary-500 group-hover:translate-x-1 transition-all duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {/* Decorative bottom wave */}
          <div className="mt-6 pt-4 border-t border-warm-300 flex items-center gap-2">
            <div className="flex gap-0.5">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-primary-500/20 rounded-full group-hover:bg-primary-500/40 transition-colors"
                  style={{
                    height: `${8 + Math.sin(i * 0.8) * 8}px`,
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-slate-850/40 ml-2">Click to begin</span>
          </div>
        </Link>

        {/* Recent Encounters Card */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-warm-200 to-warm-300 rounded-2xl border border-warm-300 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-850/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold text-slate-850">
                Recent Encounters
              </h2>
              <p className="mt-1 text-sm text-slate-850/60">
                View and manage past sessions
              </p>
            </div>
          </div>

          {/* Empty state */}
          <div className="mt-6 pt-4 border-t border-warm-300">
            <div className="text-center py-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-warm-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-850/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-slate-850/40">No encounters yet</p>
              <p className="text-xs text-slate-850/30 mt-1">Start your first session above</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Today', value: '0', sublabel: 'encounters' },
          { label: 'This Week', value: '0', sublabel: 'encounters' },
          { label: 'Notes Generated', value: '0', sublabel: 'total' },
          { label: 'Time Saved', value: '0h', sublabel: 'estimated' },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className="glass-card rounded-xl p-4 opacity-0 animate-slide-up"
            style={{ animationDelay: `${0.1 + i * 0.1}s`, animationFillMode: 'forwards' }}
          >
            <p className="text-xs text-slate-850/50 uppercase tracking-wider">{stat.label}</p>
            <p className="font-display text-2xl font-semibold text-slate-850 mt-1">{stat.value}</p>
            <p className="text-xs text-slate-850/40">{stat.sublabel}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
