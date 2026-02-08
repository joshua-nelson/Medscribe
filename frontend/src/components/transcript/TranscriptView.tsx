'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  isFinal?: boolean;
  speaker?: string;
  speakerRole?: 'Provider' | 'Patient' | 'Speaker';
};

type TranscriptViewProps = {
  recorderStatus: 'idle' | 'recording' | 'paused' | 'stopped';
  encounterStatus?: string;
  segments: TranscriptSegment[];
  fullText?: string | null;
  isProcessing: boolean;
  error?: string;
  streamStatus?: {
    mode?: 'low_latency' | 'relaxed';
    silenceMs?: number;
    reason?: 'chunk' | 'silence_window';
    noSpeech: boolean;
  };
  onSpeakerChange?: (
    segmentIndex: number,
    speaker: string,
    speakerRole: 'Provider' | 'Patient' | 'Speaker',
  ) => Promise<void> | void;
  onBulkReassign?: (
    fromSpeaker: string,
    toSpeaker: string,
    toRole: 'Provider' | 'Patient' | 'Speaker',
  ) => Promise<void> | void;
};

function formatTimestamp(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function roleToSpeaker(role: 'Provider' | 'Patient' | 'Speaker', fallback?: string) {
  if (role === 'Provider') return 'SPEAKER_0';
  if (role === 'Patient') return 'SPEAKER_1';
  return fallback || 'SPEAKER_2';
}

function speakerRoleClass(role?: 'Provider' | 'Patient' | 'Speaker') {
  if (role === 'Provider') return 'bg-sky-100 text-sky-700';
  if (role === 'Patient') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-700';
}

const JUMP_TO_LIVE_THRESHOLD_PX = 48;
const TIMESTAMP_MARKER_INTERVAL_SECONDS = 30;

export function TranscriptView({
  recorderStatus,
  encounterStatus,
  segments,
  fullText,
  isProcessing,
  error,
  streamStatus,
  onSpeakerChange,
  onBulkReassign,
}: TranscriptViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string>('');
  const [bulkFromSpeaker, setBulkFromSpeaker] = useState<string>('');
  const [bulkToRole, setBulkToRole] = useState<'Provider' | 'Patient' | 'Speaker'>('Provider');
  const hasSegments = segments.length > 0;
  const hasFullText = typeof fullText === 'string' && fullText.trim().length > 0;
  const showNoTranscriptState =
    !hasSegments && !hasFullText && (recorderStatus === 'recording' || recorderStatus === 'paused');
  const timestampMarkers = useMemo(() => {
    if (!hasSegments) return [] as number[];
    const maxEnd = segments.reduce((max, segment) => Math.max(max, segment.end), 0);
    const markers: number[] = [];
    for (
      let marker = TIMESTAMP_MARKER_INTERVAL_SECONDS;
      marker <= maxEnd;
      marker += TIMESTAMP_MARKER_INTERVAL_SECONDS
    ) {
      markers.push(marker);
    }
    return markers;
  }, [hasSegments, segments]);
  const speakerLegend = useMemo(() => {
    const seen = new Set<string>();
    return segments
      .filter((segment) => segment.speaker && segment.speakerRole)
      .filter((segment) => {
        const key = `${segment.speaker}-${segment.speakerRole}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((segment) => ({
        speaker: segment.speaker as string,
        role: segment.speakerRole as 'Provider' | 'Patient' | 'Speaker',
      }));
  }, [segments]);

  useEffect(() => {
    if (bulkFromSpeaker) return;
    const firstSpeaker = segments.find((segment) => typeof segment.speaker === 'string')?.speaker;
    if (firstSpeaker) {
      setBulkFromSpeaker(firstSpeaker);
    }
  }, [bulkFromSpeaker, segments]);

  useEffect(() => {
    if (!autoScrollEnabled) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [autoScrollEnabled, segments, fullText]);

  useEffect(() => {
    if (recorderStatus === 'idle' || recorderStatus === 'stopped') {
      setAutoScrollEnabled(true);
    }
  }, [recorderStatus]);

  const handleTranscriptScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setAutoScrollEnabled(distanceFromBottom <= JUMP_TO_LIVE_THRESHOLD_PX);
  };

  const jumpToLive = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    setAutoScrollEnabled(true);
  };

  const handleSpeakerChange = async (
    segmentIndex: number,
    nextRole: 'Provider' | 'Patient' | 'Speaker',
  ) => {
    if (!onSpeakerChange) return;
    const segment = segments[segmentIndex];
    if (!segment) return;

    setSaveError('');
    const nextSpeaker = roleToSpeaker(nextRole, segment.speaker);
    try {
      await onSpeakerChange(segmentIndex, nextSpeaker, nextRole);
      setEditingSegmentIndex(null);
    } catch {
      setSaveError('Unable to update speaker assignment. Please try again.');
    }
  };

  const handleBulkReassign = async () => {
    if (!onBulkReassign || !bulkFromSpeaker) return;
    setSaveError('');
    try {
      await onBulkReassign(bulkFromSpeaker, roleToSpeaker(bulkToRole), bulkToRole);
    } catch {
      setSaveError('Unable to apply bulk speaker reassignment. Please try again.');
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--lux-border-subtle)] bg-white p-4 shadow-[var(--lux-shadow-1)] sm:p-5">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--lux-brand-primary-soft)]">
            <svg
              className="h-5 w-5 text-[var(--lux-brand-primary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7.5 8.25h9m-9 3.75h9m-9 3.75h4.5M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-body text-lg font-semibold text-slate-900">Transcript</h3>
            <p className="font-body text-xs text-[var(--lux-text-muted)]">
              Whisper output with timestamps
            </p>
          </div>
        </div>
        <span className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-[var(--lux-text-muted)]">
          {encounterStatus || 'idle'}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {saveError && (
        <div className="mb-4 rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {speakerLegend.length > 0 && (
        <div className="mb-4 rounded-xl border border-[var(--lux-border-subtle)] bg-[var(--lux-bg-canvas)] p-3">
          <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lux-text-muted)]">
            Speaker legend
          </p>
          <div className="flex flex-wrap gap-2">
            {speakerLegend.map((entry) => (
              <span
                key={`${entry.speaker}-${entry.role}`}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${speakerRoleClass(entry.role)}`}
              >
                {entry.role}: {entry.speaker}
              </span>
            ))}
          </div>
        </div>
      )}

      {onBulkReassign && speakerLegend.length > 0 && (
        <div className="mb-4 rounded-xl border border-[var(--lux-border-subtle)] bg-white p-3">
          <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lux-text-muted)]">
            Bulk reassignment
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkFromSpeaker}
              onChange={(event) => setBulkFromSpeaker(event.target.value)}
              className="h-8 rounded-lg border border-[var(--lux-border-subtle)] bg-white px-2 text-xs text-slate-700"
            >
              {speakerLegend.map((entry) => (
                <option key={`from-${entry.speaker}`} value={entry.speaker}>
                  {entry.speaker}
                </option>
              ))}
            </select>
            <span className="font-body text-xs text-slate-500">to</span>
            <select
              value={bulkToRole}
              onChange={(event) =>
                setBulkToRole(event.target.value as 'Provider' | 'Patient' | 'Speaker')
              }
              className="h-8 rounded-lg border border-[var(--lux-border-subtle)] bg-white px-2 text-xs text-slate-700"
            >
              <option value="Provider">Provider</option>
              <option value="Patient">Patient</option>
              <option value="Speaker">Speaker</option>
            </select>
            <button
              type="button"
              onClick={handleBulkReassign}
              className="rounded-lg border border-[var(--lux-border-subtle)] bg-[var(--lux-bg-canvas)] px-3 py-1.5 font-body text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Change all
            </button>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="mb-4 rounded-xl border border-[var(--lux-brand-primary)]/20 bg-[var(--lux-brand-primary-soft)] px-4 py-3">
          <div className="flex items-center gap-3 font-body text-sm text-[var(--lux-text-secondary)]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--lux-brand-primary)]/25 border-t-[var(--lux-brand-primary)]" />
            <span>Processing audio with Whisper...</span>
          </div>
        </div>
      )}

      {streamStatus?.noSpeech && (
        <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3">
          <div className="flex items-center justify-between gap-4 text-sm text-amber-800">
            <span>No speech detected. Listening for voice input.</span>
            <span className="text-xs font-semibold uppercase tracking-[0.16em]">
              {streamStatus.mode === 'relaxed' ? 'relaxed mode' : 'low latency'}
            </span>
          </div>
          {typeof streamStatus.silenceMs === 'number' && streamStatus.silenceMs > 0 && (
            <p className="mt-1 text-xs text-amber-800/80">
              Silence: {Math.round(streamStatus.silenceMs / 100) / 10}s
            </p>
          )}
        </div>
      )}

      {showNoTranscriptState && (
        <div className="rounded-xl border border-[var(--lux-border-subtle)] bg-[var(--lux-bg-canvas)] p-5 font-body text-sm text-[var(--lux-text-muted)]">
          No transcript yet. Transcript appears after recording ends.
        </div>
      )}

      {!autoScrollEnabled && hasSegments && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={jumpToLive}
            className="rounded-lg border border-[var(--lux-brand-primary)]/25 bg-[var(--lux-brand-primary-soft)] px-3 py-1.5 font-body text-xs font-semibold text-[var(--lux-brand-primary-strong)] hover:bg-[var(--lux-brand-primary-soft)]/80"
          >
            Jump to live
          </button>
        </div>
      )}

      {!showNoTranscriptState && !isProcessing && !hasSegments && !hasFullText && (
        <div className="rounded-xl border border-[var(--lux-border-subtle)] bg-[var(--lux-bg-canvas)] p-5 font-body text-sm text-[var(--lux-text-muted)]">
          Start a recording to generate a transcript.
        </div>
      )}

      {hasSegments && (
        <div
          ref={scrollContainerRef}
          onScroll={handleTranscriptScroll}
          className="max-h-[28rem] overflow-y-auto rounded-xl border border-[var(--lux-border-subtle)] bg-white"
        >
          <ul className="divide-y divide-slate-100">
            {segments.map((segment, index) => {
              const previousEnd = index > 0 ? segments[index - 1].end : 0;
              const previousSegment = index > 0 ? segments[index - 1] : null;
              const isSameSpeakerAsPrevious =
                !!previousSegment &&
                previousSegment.speaker === segment.speaker &&
                previousSegment.speakerRole === segment.speakerRole;
              const markersInRange = timestampMarkers.filter(
                (marker) => marker > previousEnd && marker <= segment.end,
              );

              return (
                <li
                  key={`${segment.start}-${segment.end}-${index}`}
                  className={`px-4 py-3 space-y-2 ${isSameSpeakerAsPrevious ? 'bg-slate-50/40' : ''}`}
                >
                  {markersInRange.map((marker) => (
                    <div
                      key={`marker-${marker}`}
                      className="flex items-center gap-2 font-body text-[11px] text-slate-400"
                    >
                      <span className="h-px flex-1 bg-slate-200" />
                      <span className="font-semibold">{formatTimestamp(marker)}</span>
                      <span className="h-px flex-1 bg-slate-200" />
                    </div>
                  ))}

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {!isSameSpeakerAsPrevious && segment.speakerRole && (
                        <button
                          type="button"
                          onClick={() => setEditingSegmentIndex(index)}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${speakerRoleClass(segment.speakerRole)}`}
                        >
                          {segment.isFinal === false && (
                            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                          )}
                          {segment.speakerRole}
                        </button>
                      )}
                      <div className="font-body text-xs font-semibold text-[var(--lux-brand-primary-strong)]">
                        {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        segment.isFinal === false
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-[var(--lux-brand-primary-soft)] text-[var(--lux-brand-primary-strong)]'
                      }`}
                    >
                      {segment.isFinal === false ? 'Live' : 'Final'}
                    </span>
                  </div>

                  {editingSegmentIndex === index && onSpeakerChange && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--lux-border-subtle)] bg-[var(--lux-bg-canvas)] p-2">
                      <span className="font-body text-xs text-slate-600">Change speaker:</span>
                      <button
                        type="button"
                        onClick={() => handleSpeakerChange(index, 'Provider')}
                        className="rounded-md bg-sky-100 px-2 py-1 text-[11px] font-semibold text-sky-700"
                      >
                        Provider
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSpeakerChange(index, 'Patient')}
                        className="rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700"
                      >
                        Patient
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSpeakerChange(index, 'Speaker')}
                        className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700"
                      >
                        Speaker
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSegmentIndex(null)}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <p className="font-body text-sm leading-relaxed text-slate-700">{segment.text}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!hasSegments && hasFullText && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-slate-700">
            {fullText}
          </p>
        </div>
      )}
    </div>
  );
}
