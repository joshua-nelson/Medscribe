'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SoundWave } from '@/components/auth/SoundWave';
import {
  AudioRecorder,
  LiveTranscriptUpdatePayload,
  RecorderSessionStatusPayload,
  RecorderStatus,
} from '@/components/recording/AudioRecorder';
import { TranscriptSegment, TranscriptView } from '@/components/transcript/TranscriptView';
import { SummaryTabs } from '@/components/dashboard/SummaryTabs';
import api from '@/lib/api';

type TranscribeTab = 'transcript' | 'status';

type TranscriptRecord = {
  id: string;
  fullText: string | null;
  segments: unknown;
  createdAt: string;
};

type EncounterRecord = {
  id: string;
  status: string;
  transcripts: TranscriptRecord[];
};

const POLL_INTERVAL_MS = 1500;

function parseTranscriptSegments(rawSegments: unknown): TranscriptSegment[] {
  if (!Array.isArray(rawSegments)) return [];

  const parsed: Array<TranscriptSegment | null> = rawSegments.map((segment) => {
    if (!segment || typeof segment !== 'object') return null;
    const candidate = segment as {
      start?: unknown;
      end?: unknown;
      text?: unknown;
      speaker?: unknown;
      speakerRole?: unknown;
    };
    if (
      typeof candidate.start !== 'number' ||
      typeof candidate.end !== 'number' ||
      typeof candidate.text !== 'string'
    ) {
      return null;
    }
    return {
      start: candidate.start,
      end: candidate.end,
      text: candidate.text,
      isFinal: true,
      speaker: typeof candidate.speaker === 'string' ? candidate.speaker : undefined,
      speakerRole:
        candidate.speakerRole === 'Provider' ||
        candidate.speakerRole === 'Patient' ||
        candidate.speakerRole === 'Speaker'
          ? candidate.speakerRole
          : undefined,
    };
  });

  return parsed.filter((segment) => segment !== null) as TranscriptSegment[];
}

function deriveProcessingStage(encounterStatus: string, isProcessing: boolean) {
  if (encounterStatus === 'draft' || encounterStatus === 'finalized') {
    return { current: 'Ready for Review', progress: 100 };
  }
  if (!isProcessing && encounterStatus !== 'processing') {
    return { current: 'Waiting', progress: 0 };
  }
  return { current: 'ASR', progress: 82 };
}

export default function NewEncounterPage() {
  const pollingTimerRef = useRef<number | null>(null);
  const transcriptionInFlightRef = useRef<string | null>(null);
  const liveSegmentMapRef = useRef<Map<number, TranscriptSegment>>(new Map());

  const [recorderStatus, setRecorderStatus] = useState<RecorderStatus>('idle');
  const [encounterId, setEncounterId] = useState<string>('');
  const [transcriptId, setTranscriptId] = useState<string>('');
  const [encounterStatus, setEncounterStatus] = useState<string>('idle');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [transcriptError, setTranscriptError] = useState<string>('');
  const [streamStatus, setStreamStatus] = useState<{
    mode?: 'low_latency' | 'relaxed';
    silenceMs?: number;
    reason?: 'chunk' | 'silence_window';
    noSpeech: boolean;
  }>({ noSpeech: false });
  const [activeTab, setActiveTab] = useState<TranscribeTab>('transcript');
  const [providerConfirmed, setProviderConfirmed] = useState(false);
  const [calibrationPhrase, setCalibrationPhrase] = useState(
    'Hello, I am the provider for this encounter.',
  );

  const resetTranscriptState = useCallback(() => {
    liveSegmentMapRef.current.clear();
    setTranscriptId('');
    setTranscriptSegments([]);
    setTranscriptText('');
    setTranscriptError('');
    setStreamStatus({ noSpeech: false });
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current !== null) {
      window.clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const loadEncounter = useCallback(async (id: string) => {
    const response = await api.get<{ encounter: EncounterRecord }>(`/encounters/${id}`);
    const encounter = response.data.encounter;
    setEncounterStatus(encounter.status);

    const latestTranscript = encounter.transcripts[encounter.transcripts.length - 1];
    if (latestTranscript) {
      setTranscriptId(latestTranscript.id);
      setTranscriptSegments(parseTranscriptSegments(latestTranscript.segments));
      setTranscriptText(latestTranscript.fullText ?? '');
    }

    return encounter;
  }, []);

  const beginEncounterPolling = useCallback(
    (id: string) => {
      stopPolling();
      pollingTimerRef.current = window.setInterval(() => {
        void loadEncounter(id)
          .then((encounter) => {
            if (encounter.status === 'draft' || encounter.status === 'finalized') {
              setIsProcessing(false);
              stopPolling();
            }
          })
          .catch(() => undefined);
      }, POLL_INTERVAL_MS);
    },
    [loadEncounter, stopPolling],
  );

  const requestTranscription = useCallback(
    async (id: string) => {
      if (!id) return;
      if (transcriptionInFlightRef.current === id) return;

      transcriptionInFlightRef.current = id;
      setIsProcessing(true);
      setTranscriptError('');
      setEncounterStatus('processing');
      beginEncounterPolling(id);

      try {
        await api.post('/transcriptions', { encounterId: id });
        await loadEncounter(id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
        setTranscriptError(errorMessage);
      } finally {
        transcriptionInFlightRef.current = null;
        setIsProcessing(false);
        stopPolling();
      }
    },
    [beginEncounterPolling, loadEncounter, stopPolling],
  );

  const handleRecorderSessionStatus = useCallback(
    (payload: RecorderSessionStatusPayload) => {
      const nextEncounterId = payload.encounterId || payload.sessionId;

      if (payload.status === 'no_speech') {
        setStreamStatus({
          noSpeech: true,
          mode: payload.mode,
          silenceMs: payload.silenceMs,
          reason: payload.reason,
        });
      }

      if (payload.status === 'disconnected') {
        setTranscriptError('Streaming connection interrupted. Attempting to reconnect...');
      }

      if (payload.status === 'connected') {
        setTranscriptError('');
        if (nextEncounterId) {
          void loadEncounter(nextEncounterId).catch(() => undefined);
        }
      }

      if (payload.status === 'speech_detected' || payload.status === 'start_ack') {
        setStreamStatus({ noSpeech: false, mode: payload.mode });
        setTranscriptError('');
      }

      if (payload.status === 'start_ack' && nextEncounterId) {
        setEncounterId(nextEncounterId);
        setEncounterStatus('recording');
        setIsProcessing(false);
        resetTranscriptState();
        stopPolling();
        transcriptionInFlightRef.current = null;
        return;
      }

      if (payload.status === 'end_ack' && nextEncounterId) {
        setStreamStatus({ noSpeech: false });
        setEncounterId(nextEncounterId);
        void requestTranscription(nextEncounterId);
      }
    },
    [loadEncounter, requestTranscription, resetTranscriptState, stopPolling],
  );

  const handleTranscriptUpdate = useCallback(
    (payload: LiveTranscriptUpdatePayload) => {
      if (!payload.text || !Number.isFinite(payload.sequence)) {
        return;
      }

      if (payload.sessionId) {
        setEncounterId(payload.sessionId);
      }

      if (encounterStatus !== 'recording') {
        setEncounterStatus('recording');
      }
      if (isProcessing) {
        setIsProcessing(false);
      }
      if (transcriptError) {
        setTranscriptError('');
      }
      if (streamStatus.noSpeech) {
        setStreamStatus((previous) => ({ ...previous, noSpeech: false }));
      }

      const start = typeof payload.start === 'number' ? payload.start : 0;
      const end = typeof payload.end === 'number' ? payload.end : start;

      liveSegmentMapRef.current.set(payload.sequence, {
        start,
        end: Math.max(start, end),
        text: payload.text,
        isFinal: payload.isFinal,
      });

      const nextSegments = Array.from(liveSegmentMapRef.current.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, segment]) => segment);

      setTranscriptSegments(nextSegments);
      setTranscriptText(
        nextSegments
          .map((segment) => segment.text)
          .join(' ')
          .trim(),
      );
    },
    [encounterStatus, isProcessing, streamStatus.noSpeech, transcriptError],
  );

  const handleSpeakerChange = useCallback(
    async (
      segmentIndex: number,
      speaker: string,
      speakerRole: 'Provider' | 'Patient' | 'Speaker',
    ) => {
      if (!transcriptId) return;

      setTranscriptSegments((previous) =>
        previous.map((segment, index) =>
          index === segmentIndex ? { ...segment, speaker, speakerRole } : segment,
        ),
      );

      await api.patch(`/transcriptions/${transcriptId}/segments/${segmentIndex}`, {
        speaker,
        speakerRole,
      });
    },
    [transcriptId],
  );

  const handleBulkSpeakerReassign = useCallback(
    async (fromSpeaker: string, toSpeaker: string, toRole: 'Provider' | 'Patient' | 'Speaker') => {
      if (!transcriptId) return;

      setTranscriptSegments((previous) =>
        previous.map((segment) =>
          segment.speaker === fromSpeaker
            ? { ...segment, speaker: toSpeaker, speakerRole: toRole }
            : segment,
        ),
      );

      await api.patch(`/transcriptions/${transcriptId}/speakers/reassign`, {
        fromSpeaker,
        toSpeaker,
        toRole,
      });
    },
    [transcriptId],
  );

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const processingStage = deriveProcessingStage(encounterStatus, isProcessing);
  const noteReady = encounterStatus === 'draft' || encounterStatus === 'finalized';

  return (
    <div className="mx-auto w-full max-w-[1300px] space-y-4 lg:space-y-5">
      <section className="rounded-2xl border border-[var(--lux-border-subtle)] bg-[var(--lux-bg-elevated)] px-4 py-4 shadow-[var(--lux-shadow-1)] sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2">
              <SummaryTabs active="transcribe" />
            </div>
            <p className="font-body text-xs uppercase tracking-[0.16em] text-[var(--lux-text-muted)]">
              Active visit
            </p>
            <h1 className="mt-1 font-display text-[30px] leading-[1.08] text-[var(--lux-text-primary)] sm:text-[34px]">
              Transcribe Encounter
            </h1>
            <p className="mt-1 max-w-2xl font-body text-sm text-[var(--lux-text-secondary)] sm:text-base">
              Record the visit on mobile, track processing state, and open generated notes after
              audio processing is complete.
            </p>
          </div>

          <Link
            href="/encounters"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--lux-border-subtle)] bg-white px-3.5 font-body text-sm font-semibold text-[var(--lux-text-primary)] transition hover:bg-[var(--lux-bg-canvas)]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7 7-7"
              />
            </svg>
            Back to encounters
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--lux-border-subtle)] bg-white p-4 shadow-[var(--lux-shadow-1)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--lux-border-subtle)] bg-[var(--lux-bg-canvas)] px-3.5 py-3">
          <div className="min-w-0">
            <p className="font-body text-xs uppercase tracking-[0.14em] text-[var(--lux-text-muted)]">
              Encounter
            </p>
            <p className="truncate font-body text-sm font-semibold text-[var(--lux-text-primary)]">
              {encounterId || 'Pending Session ID'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="font-body text-xs uppercase tracking-[0.14em] text-[var(--lux-text-muted)]">
              Recording status
            </p>
            <p className="font-body text-sm font-semibold text-[var(--lux-text-primary)] capitalize">
              {recorderStatus}
            </p>
          </div>
          <div className="min-w-0">
            <p className="font-body text-xs uppercase tracking-[0.14em] text-[var(--lux-text-muted)]">
              Note pipeline
            </p>
            <p className="font-body text-sm font-semibold text-[var(--lux-text-primary)]">
              {processingStage.current}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-[var(--lux-border-subtle)] bg-white p-4 shadow-[var(--lux-shadow-1)] sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--lux-brand-primary)] text-white shadow-[var(--lux-shadow-brand)]">
              <SoundWave barCount={4} color="bg-white" className="h-[18px]" />
            </div>
            <div>
              <h2 className="font-body text-base font-semibold text-[var(--lux-text-primary)]">
                Recording Controls
              </h2>
              <p className="font-body text-sm text-[var(--lux-text-secondary)]">
                Start, pause, resume, and end the visit capture.
              </p>
            </div>
          </div>

          {!providerConfirmed && (
            <div className="mb-4 rounded-xl border border-[var(--lux-border-subtle)] bg-[var(--lux-bg-canvas)] p-3">
              <p className="font-body text-sm font-semibold text-[var(--lux-text-primary)]">
                Please speak first to identify yourself as the provider.
              </p>
              <p className="mt-1 font-body text-xs text-[var(--lux-text-muted)]">
                Use a short calibration phrase before the patient begins speaking.
              </p>
              <input
                type="text"
                value={calibrationPhrase}
                onChange={(event) => setCalibrationPhrase(event.target.value)}
                className="mt-2 h-9 w-full rounded-lg border border-[var(--lux-border-subtle)] bg-white px-3 text-xs text-slate-700"
                placeholder="Calibration phrase"
              />
              <button
                type="button"
                onClick={() => setProviderConfirmed(true)}
                className="mt-3 inline-flex h-9 items-center rounded-lg bg-[var(--lux-brand-primary)] px-3 font-body text-xs font-semibold text-white"
              >
                I am the provider
              </button>
            </div>
          )}

          <AudioRecorder
            onStatusChange={setRecorderStatus}
            onSessionStatus={handleRecorderSessionStatus}
            onTranscriptUpdate={handleTranscriptUpdate}
            sessionStartPayload={{
              providerSpeaker: 'SPEAKER_0',
              patientSpeaker: 'SPEAKER_1',
              providerConfirmed,
              calibrationPhrase,
            }}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--lux-border-subtle)] bg-white p-2 shadow-[var(--lux-shadow-1)]">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('transcript')}
                className={`h-9 rounded-xl font-body text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  activeTab === 'transcript'
                    ? 'bg-[var(--lux-brand-primary-soft)] text-[var(--lux-brand-primary-strong)]'
                    : 'text-[var(--lux-text-secondary)] hover:bg-[var(--lux-bg-canvas)]'
                }`}
              >
                Transcript
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('status')}
                className={`h-9 rounded-xl font-body text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  activeTab === 'status'
                    ? 'bg-[var(--lux-brand-primary-soft)] text-[var(--lux-brand-primary-strong)]'
                    : 'text-[var(--lux-text-secondary)] hover:bg-[var(--lux-bg-canvas)]'
                }`}
              >
                Status
              </button>
            </div>
          </div>

          {activeTab === 'transcript' ? (
            <TranscriptView
              recorderStatus={recorderStatus}
              encounterStatus={encounterStatus}
              segments={transcriptSegments}
              fullText={transcriptText}
              isProcessing={isProcessing}
              error={transcriptError}
              streamStatus={streamStatus}
              onSpeakerChange={handleSpeakerChange}
              onBulkReassign={handleBulkSpeakerReassign}
            />
          ) : (
            <div className="rounded-2xl border border-[var(--lux-border-subtle)] bg-white p-4 shadow-[var(--lux-shadow-1)] sm:p-5">
              <h3 className="font-body text-base font-semibold text-[var(--lux-text-primary)]">
                Processing Status
              </h3>

              <ol className="mt-3 space-y-2.5">
                {['Uploading', 'ASR', 'Note Generation'].map((step, index) => {
                  const isCurrent = processingStage.current === step;
                  const isDone = noteReady || (step === 'Uploading' && isProcessing);

                  return (
                    <li
                      key={step}
                      className="rounded-xl border border-[var(--lux-border-subtle)] bg-[var(--lux-bg-canvas)] px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-body text-sm font-semibold text-[var(--lux-text-primary)]">
                          {index + 1}. {step}
                        </p>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                            isDone
                              ? 'bg-emerald-100 text-emerald-700'
                              : isCurrent
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isDone ? 'Done' : isCurrent ? 'Current' : 'Pending'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-4 rounded-xl border border-[var(--lux-border-subtle)] bg-[var(--lux-brand-primary-soft)]/45 px-3 py-3">
                <p className="font-body text-sm text-[var(--lux-text-secondary)]">
                  Current stage:{' '}
                  <span className="font-semibold text-[var(--lux-text-primary)]">
                    {processingStage.current}
                  </span>
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[var(--lux-brand-primary)] transition-all duration-300"
                    style={{ width: `${processingStage.progress}%` }}
                  />
                </div>
                <p className="mt-2 font-body text-xs text-[var(--lux-text-muted)]">
                  {processingStage.progress}% complete
                </p>
              </div>

              <button
                type="button"
                disabled={!noteReady}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--lux-brand-primary)] px-4 font-body text-sm font-semibold text-white shadow-[var(--lux-shadow-brand)] transition enabled:hover:bg-[var(--lux-brand-primary-strong)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                Open Generated Note
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
