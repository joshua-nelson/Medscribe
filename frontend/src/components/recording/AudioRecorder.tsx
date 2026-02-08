'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createSocket } from '@/lib/socket';
import { selectAccessToken } from '@/features/auth/selectors';
import { useAppSelector } from '@/store/hooks';

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped';

export type RecorderSessionStatusPayload = {
  status?: string;
  sequence?: number;
  sessionId?: string;
  encounterId?: string;
  message?: string;
  mode?: 'low_latency' | 'relaxed';
  silenceMs?: number;
  targetBufferMs?: number;
  reason?: 'chunk' | 'silence_window';
};

export type LiveTranscriptUpdatePayload = {
  sessionId?: string;
  sequence: number;
  text: string;
  isFinal: boolean;
  start?: number;
  end?: number;
  speaker?: string;
  speakerRole?: 'Provider' | 'Patient' | 'Speaker';
  timestamp?: string;
  latencyMs?: number;
};

type TranscriptMetricsPayload = {
  stage?: string;
  sessionId?: string;
  sequence?: number | null;
  isFinal?: boolean;
  asrRoundTripMs?: number;
  chunkToTranscriptMs?: number;
};

type LiveTranscriptSegment = {
  sequence: number;
  text: string;
  isFinal: boolean;
  speaker?: string;
  speakerRole?: 'Provider' | 'Patient' | 'Speaker';
};

type SessionStartPayload = {
  providerSpeaker?: string;
  patientSpeaker?: string;
  providerConfirmed?: boolean;
  calibrationPhrase?: string;
};

type AudioRecorderProps = {
  onStop?: (audio: Blob, chunks: Blob[]) => void;
  onStatusChange?: (status: RecorderStatus) => void;
  onSessionStatus?: (payload: RecorderSessionStatusPayload) => void;
  onTranscriptUpdate?: (payload: LiveTranscriptUpdatePayload) => void;
  sessionStartPayload?: SessionStartPayload;
};

const LEVEL_BARS = 16;
const CHUNK_TIMESLICE_MS = 500;
const SPEECH_LEVEL_THRESHOLD = 0.08;
const MIME_TYPE_PREFERENCES = [
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/wav',
];

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function pickSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_TYPE_PREFERENCES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function AudioRecorder({
  onStop,
  onStatusChange,
  onSessionStatus,
  onTranscriptUpdate,
  sessionStartPayload,
}: AudioRecorderProps) {
  const accessToken = useAppSelector(selectAccessToken);
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<string>('');
  const [level, setLevel] = useState<number>(0);
  const [elapsed, setElapsed] = useState<number>(0);
  const [socketStatus, setSocketStatus] = useState<string>('disconnected');
  const [lastAckSequence, setLastAckSequence] = useState<number | null>(null);
  const [lastAckAt, setLastAckAt] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [transcriptSegments, setTranscriptSegments] = useState<LiveTranscriptSegment[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sequenceRef = useRef<number>(0);
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const endSessionTimeoutRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const elapsedBeforeRef = useRef<number>(0);
  const chunkSendChainRef = useRef<Promise<void>>(Promise.resolve());
  const sessionEndEmittedRef = useRef<boolean>(false);
  const levelRef = useRef<number>(0);
  const lastChunkCapturedAtMsRef = useRef<number | null>(null);
  const currentEncounterIdRef = useRef<string>('');

  const stopLevelMonitor = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    levelRef.current = 0;
    setLevel(0);
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const cleanupRecorder = useCallback(() => {
    stopTimer();
    stopLevelMonitor();
    stopStream();
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (endSessionTimeoutRef.current !== null) {
      window.clearTimeout(endSessionTimeoutRef.current);
      endSessionTimeoutRef.current = null;
    }
    chunkSendChainRef.current = Promise.resolve();
    sessionEndEmittedRef.current = false;
    lastChunkCapturedAtMsRef.current = null;
    currentEncounterIdRef.current = '';
    setSocketStatus('disconnected');
    setSessionId('');
    mediaRecorderRef.current = null;
  }, [stopLevelMonitor, stopStream, stopTimer]);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = window.setInterval(() => {
      const startedAt = startedAtRef.current;
      if (!startedAt) {
        setElapsed(elapsedBeforeRef.current);
        return;
      }
      const current = elapsedBeforeRef.current + (Date.now() - startedAt) / 1000;
      setElapsed(current);
    }, 250);
  }, [stopTimer]);

  const startLevelMonitor = useCallback(
    (stream: MediaStream) => {
      stopLevelMonitor();
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          sum += data[i];
        }
        const avg = sum / data.length;
        const normalizedLevel = Math.min(1, avg / 128);
        levelRef.current = normalizedLevel;
        setLevel(normalizedLevel);
        animationFrameRef.current = requestAnimationFrame(tick);
      };

      animationFrameRef.current = requestAnimationFrame(tick);
    },
    [stopLevelMonitor],
  );

  const startRecording = useCallback(async () => {
    setError('');
    setSessionId('');
    setTranscriptSegments([]);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone access is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const socket = createSocket(accessToken);
      socketRef.current = socket;
      socket.on('connect', () => {
        setSocketStatus('connected');
        onSessionStatus?.({
          status: 'connected',
          encounterId: currentEncounterIdRef.current || undefined,
          sessionId: currentEncounterIdRef.current || undefined,
        });
      });
      socket.on('disconnect', () => {
        setSocketStatus('disconnected');
        onSessionStatus?.({
          status: 'disconnected',
          encounterId: currentEncounterIdRef.current || undefined,
          sessionId: currentEncounterIdRef.current || undefined,
        });
      });
      socket.on('connect_error', () => {
        setError('Unable to connect to streaming server.');
        setSocketStatus('error');
        onSessionStatus?.({ status: 'error', message: 'Unable to connect to streaming server.' });
      });
      socket.on('session:status', (payload?: RecorderSessionStatusPayload) => {
        if (!payload) return;
        if (payload.status && payload.status !== 'chunk_ack') {
          setSocketStatus(payload.status);
        }
        if (payload.sessionId) {
          setSessionId(payload.sessionId);
          currentEncounterIdRef.current = payload.sessionId;
        }
        if (payload.encounterId) {
          setSessionId(payload.encounterId);
          currentEncounterIdRef.current = payload.encounterId;
        }
        if (typeof payload.sequence === 'number') {
          setLastAckSequence(payload.sequence);
          setLastAckAt(new Date().toLocaleTimeString());
        }
        onSessionStatus?.(payload);

        if (payload.status === 'end_ack') {
          sessionEndEmittedRef.current = false;
          if (endSessionTimeoutRef.current !== null) {
            window.clearTimeout(endSessionTimeoutRef.current);
            endSessionTimeoutRef.current = null;
          }
          window.setTimeout(() => {
            if (socketRef.current === socket) {
              socket.disconnect();
              socketRef.current = null;
            }
          }, 100);
        }
      });

      await new Promise<void>((resolve, reject) => {
        if (socket.connected) {
          resolve();
          return;
        }

        const timeoutId = window.setTimeout(() => {
          socket.off('connect', onConnect);
          socket.off('connect_error', onConnectError);
          reject(new Error('Timed out connecting to streaming server'));
        }, 8000);

        const onConnect = () => {
          window.clearTimeout(timeoutId);
          socket.off('connect_error', onConnectError);
          resolve();
        };

        const onConnectError = () => {
          window.clearTimeout(timeoutId);
          socket.off('connect', onConnect);
          reject(new Error('Unable to connect to streaming server.'));
        };

        socket.once('connect', onConnect);
        socket.once('connect_error', onConnectError);
      });

      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          socket.off('session:status', onStartStatus);
          reject(new Error('Timed out waiting for session start acknowledgment'));
        }, 8000);

        const onStartStatus = (payload?: RecorderSessionStatusPayload) => {
          if (!payload?.status) return;

          if (payload.status === 'start_ack') {
            window.clearTimeout(timeoutId);
            socket.off('session:status', onStartStatus);
            resolve();
            return;
          }

          if (payload.status === 'error') {
            window.clearTimeout(timeoutId);
            socket.off('session:status', onStartStatus);
            reject(new Error(payload.message || 'Failed to start recording session'));
          }
        };

        socket.on('session:status', onStartStatus);
        socket.emit('session:start', sessionStartPayload);
      });

      startLevelMonitor(stream);

      socket.on('transcript:update', (payload?: LiveTranscriptUpdatePayload) => {
        if (!payload || typeof payload.sequence !== 'number' || !payload.text) return;

        onTranscriptUpdate?.(payload);
        setTranscriptSegments((previous) => {
          const index = previous.findIndex((segment) => segment.sequence === payload.sequence);
          if (index === -1) {
            return [
              ...previous,
              {
                sequence: payload.sequence,
                text: payload.text,
                isFinal: payload.isFinal,
                speaker: payload.speaker,
                speakerRole: payload.speakerRole,
              },
            ]
              .sort((a, b) => a.sequence - b.sequence)
              .slice(-10);
          }

          const next = [...previous];
          next[index] = {
            sequence: payload.sequence,
            text: payload.text,
            isFinal: payload.isFinal,
            speaker: payload.speaker,
            speakerRole: payload.speakerRole,
          };
          return next.sort((a, b) => a.sequence - b.sequence).slice(-10);
        });
      });

      if (process.env.NODE_ENV !== 'production') {
        socket.on('transcript:metrics', (payload?: TranscriptMetricsPayload) => {
          if (!payload?.stage) return;
          console.debug('[transcript:metrics]', payload);
        });
      }

      const preferredMimeType = pickSupportedMimeType();
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      sequenceRef.current = 0;
      chunkSendChainRef.current = Promise.resolve();
      sessionEndEmittedRef.current = false;
      lastChunkCapturedAtMsRef.current = null;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          const currentSequence = sequenceRef.current;
          const clientCapturedAtMs = Date.now();
          const previousCapturedAtMs = lastChunkCapturedAtMsRef.current;
          lastChunkCapturedAtMsRef.current = clientCapturedAtMs;
          const chunkDurationMs = previousCapturedAtMs
            ? Math.max(100, Math.min(5000, clientCapturedAtMs - previousCapturedAtMs))
            : CHUNK_TIMESLICE_MS;
          sequenceRef.current += 1;

          const chunk = event.data;
          const mimeType = event.data.type || recorder.mimeType;
          chunkSendChainRef.current = chunkSendChainRef.current
            .then(async () => {
              const buffer = await chunk.arrayBuffer();
              const socketClient = socketRef.current;
              if (!socketClient || !socketClient.connected) return;
              const clientSentAtMs = Date.now();
              socketClient.emit('audio:chunk', {
                sequence: currentSequence,
                mimeType,
                durationMs: chunkDurationMs,
                inputLevel: levelRef.current,
                speechLikely: levelRef.current >= SPEECH_LEVEL_THRESHOLD,
                clientCapturedAtMs,
                clientSentAtMs,
                data: buffer,
              });
            })
            .catch(() => undefined);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType });
        onStop?.(audioBlob, [...chunksRef.current]);

        const finalizeSessionEnd = async () => {
          try {
            await chunkSendChainRef.current;
          } catch {
            // Ignore chunk send failures and still end session to avoid hanging recorder state.
          }

          const socketClient = socketRef.current;
          if (!socketClient || sessionEndEmittedRef.current) return;

          sessionEndEmittedRef.current = true;
          socketClient.emit('session:end');

          if (endSessionTimeoutRef.current !== null) {
            window.clearTimeout(endSessionTimeoutRef.current);
          }
          endSessionTimeoutRef.current = window.setTimeout(() => {
            socketClient.disconnect();
            if (socketRef.current === socketClient) {
              socketRef.current = null;
            }
            endSessionTimeoutRef.current = null;
            sessionEndEmittedRef.current = false;
          }, 5000);
        };

        void finalizeSessionEnd();
      };

      recorder.start(CHUNK_TIMESLICE_MS);
      startedAtRef.current = Date.now();
      elapsedBeforeRef.current = 0;
      setElapsed(0);
      setStatus('recording');
      startTimer();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to start recording session.';
      setError(message);
      cleanupRecorder();
    }
  }, [
    accessToken,
    cleanupRecorder,
    onSessionStatus,
    onStop,
    onTranscriptUpdate,
    sessionStartPayload,
    startLevelMonitor,
    startTimer,
  ]);

  const pauseRecording = useCallback(() => {
    if (!mediaRecorderRef.current || status !== 'recording') return;
    mediaRecorderRef.current.pause();
    socketRef.current?.emit('session:pause');
    if (startedAtRef.current) {
      elapsedBeforeRef.current += (Date.now() - startedAtRef.current) / 1000;
      startedAtRef.current = null;
    }
    lastChunkCapturedAtMsRef.current = null;
    setStatus('paused');
  }, [status]);

  const resumeRecording = useCallback(() => {
    if (!mediaRecorderRef.current || status !== 'paused') return;
    mediaRecorderRef.current.resume();
    socketRef.current?.emit('session:resume');
    startedAtRef.current = Date.now();
    lastChunkCapturedAtMsRef.current = null;
    setStatus('recording');
  }, [status]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || (status !== 'recording' && status !== 'paused')) return;

    const shouldStop = window.confirm(
      'Stop recording? This will end the current recording session.',
    );
    if (!shouldStop) {
      return;
    }

    if (startedAtRef.current) {
      elapsedBeforeRef.current += (Date.now() - startedAtRef.current) / 1000;
      startedAtRef.current = null;
    }
    if (mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setStatus('stopped');
    stopTimer();
    stopLevelMonitor();
    stopStream();
  }, [status, stopLevelMonitor, stopStream, stopTimer]);

  useEffect(() => {
    return () => {
      cleanupRecorder();
    };
  }, [cleanupRecorder]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useEffect(() => {
    if (status !== 'recording' && status !== 'paused') {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [status]);

  const isRecording = status === 'recording';
  const isPaused = status === 'paused';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-body text-sm text-slate-500">Recording duration</p>
          <p className="font-body text-2xl font-semibold text-slate-900">
            {formatDuration(elapsed)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
              isRecording
                ? 'bg-emerald-100 text-emerald-700'
                : isPaused
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isRecording
                  ? 'bg-emerald-500 animate-pulse'
                  : isPaused
                    ? 'bg-amber-500'
                    : 'bg-slate-300'
              }`}
            />
            {isRecording
              ? 'Recording'
              : isPaused
                ? 'Paused'
                : status === 'stopped'
                  ? 'Stopped'
                  : 'Idle'}
          </span>
          <span className="font-body text-xs text-slate-400">
            {status === 'idle'
              ? 'Ready to capture'
              : status === 'stopped'
                ? 'Session ended'
                : 'Mic active'}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--lux-border-subtle)] bg-[var(--lux-bg-canvas)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-body text-xs uppercase tracking-[0.2em] text-slate-400">
              Audio input
            </p>
            <p className="font-body text-sm text-[var(--lux-text-secondary)]">
              Speak to verify the mic is live.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: LEVEL_BARS }).map((_, index) => {
              const threshold = (index + 1) / LEVEL_BARS;
              const active = level >= threshold;
              return (
                <span
                  key={index}
                  className={`h-6 w-1.5 rounded-full transition-all ${
                    active ? 'bg-[var(--lux-brand-primary)]/80' : 'bg-slate-200'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-1 rounded-2xl border border-[var(--lux-border-subtle)] bg-white p-4 font-body text-xs text-[var(--lux-text-secondary)]">
        <div className="flex items-center justify-between">
          <span className="uppercase tracking-[0.18em]">Socket</span>
          <span className="font-semibold text-slate-700">{socketStatus}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Session ID</span>
          <span className="font-semibold text-slate-700">{sessionId || '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Last chunk ack</span>
          <span className="font-semibold text-slate-700">
            {lastAckSequence === null ? '—' : `#${lastAckSequence}`}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Last ack time</span>
          <span className="font-semibold text-slate-700">{lastAckAt || '—'}</span>
        </div>
      </div>

      {transcriptSegments.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-[var(--lux-border-subtle)] bg-white p-4 font-body text-xs text-[var(--lux-text-secondary)]">
          <div className="flex items-center justify-between">
            <span className="uppercase tracking-[0.18em]">Live transcript</span>
            <span className="font-semibold text-slate-700">Streaming</span>
          </div>
          <div className="space-y-2 font-body text-sm text-slate-700">
            {transcriptSegments.map((segment, index) => (
              <p key={`${segment.sequence}-${index}`}>
                <span className="mr-2 font-semibold text-[var(--lux-brand-primary-strong)]">
                  {segment.isFinal ? 'Final' : 'Live'}
                </span>
                {segment.speakerRole && (
                  <span className="mr-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                    {segment.speakerRole}
                  </span>
                )}
                {segment.text}
              </p>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200/60 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={startRecording}
          disabled={status === 'recording' || status === 'paused'}
          className="rounded-xl bg-[var(--lux-brand-primary)] px-4 py-2.5 font-body text-sm font-semibold text-white shadow-[var(--lux-shadow-brand)] transition hover:bg-[var(--lux-brand-primary-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start
        </button>
        <button
          type="button"
          onClick={pauseRecording}
          disabled={!isRecording}
          className="rounded-xl bg-amber-100 px-4 py-2.5 font-body text-sm font-semibold text-amber-700 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Pause
        </button>
        <button
          type="button"
          onClick={resumeRecording}
          disabled={!isPaused}
          className="rounded-xl bg-slate-100 px-4 py-2.5 font-body text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Resume
        </button>
        <button
          type="button"
          onClick={stopRecording}
          disabled={status === 'idle' || status === 'stopped'}
          className="rounded-xl bg-slate-900 px-4 py-2.5 font-body text-sm font-semibold text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
