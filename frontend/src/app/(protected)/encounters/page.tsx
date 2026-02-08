'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

const filterOptions = ['Active', 'Processing', 'Ready', 'Finalized'] as const;
type EncounterEntity = {
  id: string;
  patientName: string | null;
  status: string;
  startedAt: string;
  endedAt: string | null;
};

function toDisplayStatus(status: string) {
  if (status === 'recording') return 'Active';
  if (status === 'processing') return 'Processing';
  if (status === 'draft') return 'Ready';
  if (status === 'finalized') return 'Finalized';
  return status;
}

function statusClass(status: string) {
  if (status === 'draft') return 'bg-emerald-100 text-emerald-700';
  if (status === 'processing') return 'bg-sky-100 text-sky-700';
  if (status === 'finalized') return 'bg-slate-100 text-slate-700';
  return 'bg-amber-100 text-amber-700';
}

function encounterDetail(status: string) {
  if (status === 'draft') return 'Draft SOAP generated and available for review';
  if (status === 'processing') return 'Audio upload completed. ASR in progress';
  if (status === 'finalized') return 'Final note finalized and ready for EHR workflow';
  return 'Recording in progress';
}

function encounterTime(startedAt: string) {
  return new Date(startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function encounterDuration(startedAt: string, endedAt: string | null, status: string) {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diffMs = Math.max(end - start, 0);
  const minutes = Math.floor(diffMs / 60000);

  if (status === 'processing' || status === 'recording') return 'In progress';
  if (minutes < 1) return '<1m audio';
  return `${minutes}m audio`;
}

export default function EncountersPage() {
  const [encounters, setEncounters] = useState<EncounterEntity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<(typeof filterOptions)[number]>('Active');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadEncounters() {
      try {
        setIsLoading(true);
        setError('');
        const response = await api.get<{ encounters: EncounterEntity[] }>('/encounters');
        if (!isMounted) return;
        setEncounters(response.data.encounters);
      } catch {
        if (!isMounted) return;
        setError('Unable to load encounters right now.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadEncounters();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredEncounters = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return encounters.filter((encounter) => {
      const displayStatus = toDisplayStatus(encounter.status);
      const matchesFilter = displayStatus === activeFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        encounter.id.toLowerCase().includes(normalizedSearch) ||
        (encounter.patientName || 'New Patient').toLowerCase().includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, encounters, searchTerm]);

  return (
    <div className="mx-auto w-full max-w-[1300px] space-y-4 lg:space-y-5">
      <section className="rounded-2xl border border-[var(--lux-border-subtle)] bg-[var(--lux-bg-elevated)] px-4 py-4 shadow-[var(--lux-shadow-1)] sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-body text-xs uppercase tracking-[0.16em] text-[var(--lux-text-muted)]">
              Encounter library
            </p>
            <h1 className="mt-1 font-display text-[30px] leading-[1.08] text-[var(--lux-text-primary)] sm:text-[34px]">
              Encounters
            </h1>
            <p className="mt-1 max-w-2xl font-body text-sm text-[var(--lux-text-secondary)] sm:text-base">
              Search, filter, and reopen transcripts and generated notes with minimal clicks.
            </p>
          </div>

          <Link
            href="/encounters/new"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--lux-brand-primary)] px-4 font-body text-sm font-semibold text-white shadow-[var(--lux-shadow-brand)] transition hover:bg-[var(--lux-brand-primary-strong)]"
          >
            New Encounter
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--lux-border-subtle)] bg-white p-4 shadow-[var(--lux-shadow-1)] sm:p-5">
        <div className="grid gap-3">
          <label htmlFor="encounter-search" className="sr-only">
            Search encounters
          </label>
          <input
            id="encounter-search"
            type="search"
            placeholder="Search by patient or encounter ID"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-11 w-full rounded-xl border border-[var(--lux-border-subtle)] bg-[var(--lux-bg-canvas)] px-3.5 font-body text-sm text-[var(--lux-text-primary)] outline-none placeholder:text-[var(--lux-text-muted)] focus:border-[var(--lux-brand-primary)] focus:ring-2 focus:ring-[var(--lux-brand-primary)]/20"
          />

          <div className="flex flex-wrap gap-2">
            {filterOptions.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`inline-flex h-9 items-center rounded-full px-3.5 font-body text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  activeFilter === filter
                    ? 'bg-[var(--lux-brand-primary-soft)] text-[var(--lux-brand-primary-strong)]'
                    : 'border border-[var(--lux-border-subtle)] bg-white text-[var(--lux-text-secondary)] hover:bg-[var(--lux-bg-canvas)]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-2.5">
        {isLoading && (
          <p className="rounded-2xl border border-[var(--lux-border-subtle)] bg-white p-4 font-body text-sm text-[var(--lux-text-secondary)] shadow-[var(--lux-shadow-1)] sm:p-5">
            Loading encounters...
          </p>
        )}

        {!isLoading && error && (
          <p className="rounded-2xl border border-[var(--lux-border-subtle)] bg-white p-4 font-body text-sm text-[var(--lux-text-secondary)] shadow-[var(--lux-shadow-1)] sm:p-5">
            {error}
          </p>
        )}

        {!isLoading && !error && filteredEncounters.length === 0 && (
          <p className="rounded-2xl border border-[var(--lux-border-subtle)] bg-white p-4 font-body text-sm text-[var(--lux-text-secondary)] shadow-[var(--lux-shadow-1)] sm:p-5">
            No encounters match your filters.
          </p>
        )}

        {!isLoading &&
          !error &&
          filteredEncounters.map((encounter) => (
            <article
              key={encounter.id}
              className="rounded-2xl border border-[var(--lux-border-subtle)] bg-white p-4 shadow-[var(--lux-shadow-1)] sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-body text-base font-semibold text-[var(--lux-text-primary)]">
                      {encounter.patientName || 'New Patient'}
                    </p>
                    <span className="font-body text-xs text-[var(--lux-text-muted)]">
                      {encounter.id}
                    </span>
                  </div>
                  <p className="mt-1 font-body text-sm text-[var(--lux-text-secondary)]">
                    {encounterDetail(encounter.status)}
                  </p>
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusClass(encounter.status)}`}
                >
                  {toDisplayStatus(encounter.status)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--lux-border-subtle)] pt-3">
                <p className="font-body text-xs text-[var(--lux-text-muted)]">
                  {encounterTime(encounter.startedAt)} •{' '}
                  {encounterDuration(encounter.startedAt, encounter.endedAt, encounter.status)}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/encounters/new"
                    className="inline-flex h-8 items-center rounded-lg border border-[var(--lux-border-subtle)] bg-[var(--lux-bg-canvas)] px-3 font-body text-xs font-semibold text-[var(--lux-text-primary)]"
                  >
                    Open Transcript
                  </Link>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center rounded-lg border border-[var(--lux-border-subtle)] bg-white px-3 font-body text-xs font-semibold text-[var(--lux-text-primary)]"
                  >
                    Open Note
                  </button>
                </div>
              </div>
            </article>
          ))}
      </section>
    </div>
  );
}
