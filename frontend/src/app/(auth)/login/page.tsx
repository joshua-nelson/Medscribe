'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SoundWave } from '@/components/auth/SoundWave';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch {
      setError('Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--lux-bg-canvas)] p-4 lg:p-8">
      <div className="mx-auto w-full max-w-[1240px] overflow-hidden rounded-2xl border border-[var(--lux-border-subtle)] bg-white shadow-[0_14px_50px_rgba(16,24,40,0.12)] lg:grid lg:min-h-[760px] lg:grid-cols-2">
        <aside className="relative hidden overflow-hidden rounded-l-2xl text-white lg:block">
          <div className="absolute inset-0 rounded-l-2xl bg-[linear-gradient(145deg,#6E56CF_0%,#5B45B0_56%,#8B77DE_100%)]" />
          <div className="absolute -left-16 top-[-90px] h-[360px] w-[360px] rotate-12 bg-white/10" />
          <div className="absolute left-[34%] top-[-40px] h-[440px] w-[240px] -rotate-[42deg] bg-white/10" />
          <div className="absolute right-[-90px] top-[140px] h-[260px] w-[340px] -rotate-12 bg-white/12" />
          <div className="absolute right-[130px] top-[195px] h-[170px] w-[220px] -rotate-[20deg] bg-white/14" />

          <div className="relative z-10 flex h-full flex-col p-10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/15">
                <SoundWave barCount={3} color="bg-white" className="h-5" />
              </div>
              <p className="font-body text-2xl font-semibold tracking-tight">MedScribe</p>
            </div>

            <div className="my-auto max-w-sm">
              <h2 className="font-body text-[46px] font-semibold leading-[1.1] tracking-[-0.01em]">
                Notes that write themselves.
              </h2>
              <p className="mt-4 font-body text-lg leading-relaxed text-white/80">
                Real-time medical transcription and SOAP note generation so clinicians can focus on
                patients.
              </p>
            </div>

            <div className="flex items-center gap-2 pb-2">
              <span className="h-1.5 w-6 rounded-full bg-white/65" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
          <div className="w-full max-w-[520px]">
            <h1 className="font-display text-[42px] font-semibold tracking-[-0.01em] text-[var(--lux-text-primary)]">
              Login
            </h1>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4.5 sm:mt-7">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block font-body text-sm font-medium text-slate-800"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12 w-full rounded-lg border border-[var(--lux-border-strong)] bg-[var(--lux-bg-elevated)] px-4 font-body text-sm text-[var(--lux-text-primary)] outline-none transition focus:border-[var(--lux-brand-primary)] focus:ring-2 focus:ring-[var(--lux-brand-primary)]/20"
                  placeholder="name@mail.com"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-1.5">
                  <label
                    htmlFor="password"
                    className="font-body text-sm font-medium text-slate-800"
                  >
                    Password
                  </label>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 w-full rounded-lg border border-[var(--lux-border-strong)] bg-[var(--lux-bg-elevated)] px-4 font-body text-sm text-[var(--lux-text-primary)] outline-none transition focus:border-[var(--lux-brand-primary)] focus:ring-2 focus:ring-[var(--lux-brand-primary)]/20"
                  placeholder="********"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    className="rounded-md px-1 py-1 font-body text-xs font-semibold text-[var(--lux-brand-primary-strong)] hover:underline"
                  >
                    Reset Password
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-[var(--lux-border-subtle)] bg-[var(--lux-bg-elevated)] px-3 py-2 font-body text-sm text-[var(--lux-text-secondary)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--lux-border-strong)] text-[var(--lux-brand-primary)] focus:ring-[var(--lux-brand-primary)]/30"
                />
                Remember Password
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full rounded-lg bg-[var(--lux-brand-primary)] font-body text-sm font-semibold text-white transition hover:bg-[var(--lux-brand-primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Logging in...' : 'Login'}
              </button>

              <p className="text-center font-body text-base text-slate-700">
                Don&apos;t have an account?{' '}
                <a href="#" className="font-medium text-[var(--lux-brand-primary-strong)]">
                  Sign up
                </a>
              </p>

              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[var(--lux-text-muted)]">
                <span className="h-px flex-1 bg-[var(--lux-border-subtle)]" />
                <span>or</span>
                <span className="h-px flex-1 bg-[var(--lux-border-subtle)]" />
              </div>

              <button
                type="button"
                className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-[var(--lux-border-subtle)] bg-white font-body text-sm font-medium text-[var(--lux-text-primary)] hover:bg-[var(--lux-bg-elevated)]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.7h5.5a4.7 4.7 0 01-2 3.1v2.6h3.2c1.9-1.8 3.1-4.5 3.1-7.4z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.6c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.2H3.1v2.7A10 10 0 0012 22z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.4 13.7a6 6 0 010-3.4V7.6H3.1A10 10 0 002 12c0 1.6.4 3.2 1.1 4.4l3.3-2.7z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.8 9.8 0 0012 2 10 10 0 003.1 7.6l3.3 2.7c.8-2.4 3-4.2 5.6-4.2z"
                  />
                </svg>
                Authorize with Google
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
