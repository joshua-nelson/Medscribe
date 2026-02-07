import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { verifyAccessToken } from './services/authService';
import { config } from './config';
import prisma from './models/prisma';
import { saveAudioFile } from './services/audioStorage';
import {
  AsrServiceError,
  TranscriptSegment,
  transcribeAudioChunks,
} from './services/transcriptionService';
import {
  pruneChunkQueue,
  selectChunksForWindow,
  TimedAudioChunk,
  toSessionTimelineSegment,
} from './services/streamWindow';

type SessionStatus =
  | 'connected'
  | 'start_ack'
  | 'pause_ack'
  | 'resume_ack'
  | 'end_ack'
  | 'chunk_ack'
  | 'no_speech'
  | 'speech_detected'
  | 'error';

type AudioChunkPayload = {
  sequence?: number;
  mimeType?: string;
  durationMs?: number;
  inputLevel?: number;
  speechLikely?: boolean;
  clientCapturedAtMs?: number;
  clientSentAtMs?: number;
  data?: ArrayBuffer | Uint8Array | Buffer;
};

type EmittedTranscriptSegment = TranscriptSegment & {
  sequence: number;
};

type ChunkTimingMarker = {
  sequence: number | null;
  clientCapturedAtMs: number | null;
  clientSentAtMs: number | null;
  serverReceivedAtMs: number;
};

type AsrTimingMarker = {
  asrRequestStartAtMs: number;
  asrResponseAtMs: number;
  asrRoundTripMs: number;
};

type RecordingSession = {
  providerId: string;
  encounterId: string;
  chunks: Buffer[];
  streamChunkQueue: TimedAudioChunk[];
  mimeType?: string;
  startedAt: number;
  transcriptSequence: number;
  totalDurationMs: number;
  processedAudioMs: number;
  isTranscribing: boolean;
  pendingProcessing: boolean;
  finalizedSegments: EmittedTranscriptSegment[];
  finalizedEndMs: number;
  partialSegment: EmittedTranscriptSegment | null;
  silenceDurationMs: number;
  lastNoSpeechHeartbeatAtMs: number;
  latestInputLevel: number | null;
  latestChunkTiming: ChunkTimingMarker | null;
  latestAsrTiming: AsrTimingMarker | null;
};

type TranscriptUpdatePayload = {
  sessionId: string;
  sequence: number;
  text: string;
  isFinal: boolean;
  start: number;
  end: number;
  speaker?: string;
  speakerRole?: 'Provider' | 'Patient' | 'Speaker';
  timestamp: string;
  latencyMs?: number;
};

type SessionStartPayload = {
  providerSpeaker?: string;
  patientSpeaker?: string;
  providerConfirmed?: boolean;
  calibrationPhrase?: string;
};

type TranscriptMetricEventPayload = {
  stage: 'chunk_received' | 'asr_roundtrip' | 'transcript_emitted';
  sessionId: string;
  sequence?: number | null;
  isFinal?: boolean;
  clientCapturedAtMs?: number | null;
  clientSentAtMs?: number | null;
  serverReceivedAtMs?: number;
  asrRequestStartAtMs?: number;
  asrResponseAtMs?: number;
  transcriptEmitAtMs?: number;
  asrRoundTripMs?: number;
  chunkToTranscriptMs?: number;
};

type LatencyMetricKey = 'asrRoundTripMs' | 'chunkToPartialMs' | 'chunkToFinalMs';

type LatencyMetricBuckets = {
  asrRoundTripMs: number[];
  chunkToPartialMs: number[];
  chunkToFinalMs: number[];
};

type StreamSchedulingMode = 'low_latency' | 'relaxed';

type StreamWindowStrategy = {
  mode: StreamSchedulingMode;
  targetBufferMs: number;
  isBacklogged: boolean;
};

const DEFAULT_CHUNK_DURATION_MS = 500;
const MAX_CHUNK_DURATION_MS = 5000;
const SEGMENT_OVERLAP_TOLERANCE_SEC = 0.35;
const MIN_NEW_SEGMENT_MS = 120;
const METRICS_LOG_INTERVAL_MS = 30_000;
const MAX_METRIC_SAMPLES = 5_000;
const SPEECH_LEVEL_THRESHOLD = 0.08;
const LOW_LATENCY_BUFFER_TARGET_MS = 1600;
const RELAXED_BUFFER_TARGET_MS = 2750;
const SILENCE_MODE_THRESHOLD_MS = 1800;
const NO_SPEECH_HEARTBEAT_INTERVAL_MS = 1500;

const MOCK_TRANSCRIPT_SEGMENTS = [
  'Mock transcript: starting to capture the visit audio.',
  'Mock transcript: audio chunks are streaming in real time.',
  'Mock transcript: clinician notes will appear here.',
  'Mock transcript: continue speaking for updates.',
];

function sanitizeChunkDurationMs(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_CHUNK_DURATION_MS;
  }

  const rounded = Math.round(value);
  if (rounded <= 0) return DEFAULT_CHUNK_DURATION_MS;
  if (rounded > MAX_CHUNK_DURATION_MS) return MAX_CHUNK_DURATION_MS;
  return rounded;
}

function sanitizeClientTimestampMs(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded <= 0) return null;
  return rounded;
}

function sanitizeInputLevel(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function toChunkBuffer(data: AudioChunkPayload['data']) {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  return null;
}

function isRecoverableAsrWindowError(error: AsrServiceError) {
  if (
    error.status === 429 ||
    error.status === 400 ||
    error.status === 415 ||
    error.status === 422
  ) {
    return true;
  }

  if (error.status < 500) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('failed to load audio') ||
    message.includes('invalid data found when processing input') ||
    message.includes('ebml header parsing failed') ||
    message.includes('error opening input')
  );
}

function isWebmMimeType(mimeType?: string) {
  if (!mimeType) return false;
  return mimeType.toLowerCase().includes('webm');
}

function normalizeText(text: string) {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isSegmentRelated(a: TranscriptSegment, b: TranscriptSegment) {
  const textA = normalizeText(a.text);
  const textB = normalizeText(b.text);

  if (!textA || !textB) return false;

  const timeOverlap =
    a.start <= b.end + SEGMENT_OVERLAP_TOLERANCE_SEC &&
    b.start <= a.end + SEGMENT_OVERLAP_TOLERANCE_SEC;

  if (!timeOverlap) return false;

  if (textA === textB) return true;
  if (textA.length >= 8 && textB.startsWith(textA)) return true;
  if (textB.length >= 8 && textA.startsWith(textB)) return true;
  return false;
}

function normalizeSegments(segments: TranscriptSegment[]) {
  return segments
    .filter(
      (segment) =>
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.end > segment.start &&
        typeof segment.text === 'string' &&
        segment.text.trim().length > 0,
    )
    .map((segment) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text.trim(),
    }))
    .sort((a, b) => a.start - b.start);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createLatencyMetricBuckets(): LatencyMetricBuckets {
  return {
    asrRoundTripMs: [],
    chunkToPartialMs: [],
    chunkToFinalMs: [],
  };
}

function percentile(values: number[], value: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const boundedPercentile = Math.min(100, Math.max(0, value));
  const index = Math.floor((boundedPercentile / 100) * (sorted.length - 1));
  return Math.round(sorted[index]);
}

function summarizeLatencyMetrics(values: number[]) {
  if (values.length === 0) return null;
  return {
    count: values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
  };
}

function formatLatencySummary(label: string, values: number[]) {
  const summary = summarizeLatencyMetrics(values);
  if (!summary || summary.p50 === null || summary.p95 === null) {
    return `${label}=no-data`;
  }
  return `${label}=p50:${summary.p50}ms p95:${summary.p95}ms n:${summary.count}`;
}

function pruneStreamingQueue(session: RecordingSession) {
  if (isWebmMimeType(session.mimeType)) {
    // WebM windows need the initial segment metadata to remain decodable.
    return;
  }

  const minRetainedEndMs = Math.max(
    0,
    session.processedAudioMs - config.transcription.streamOverlapMs - MAX_CHUNK_DURATION_MS,
  );
  pruneChunkQueue(session.streamChunkQueue, minRetainedEndMs);
}

export function initSocket(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: config.frontend.url,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  const metricsEnabled = config.transcription.metricsEnabled;
  const metricsDebugEventsEnabled = metricsEnabled && !config.isProduction;
  let latencyMetrics = createLatencyMetricBuckets();

  const recordLatencyMetric = (key: LatencyMetricKey, value: number | null) => {
    if (!metricsEnabled || value === null || !Number.isFinite(value) || value < 0) {
      return;
    }

    const bucket = latencyMetrics[key];
    bucket.push(Math.round(value));
    if (bucket.length > MAX_METRIC_SAMPLES) {
      bucket.splice(0, bucket.length - MAX_METRIC_SAMPLES);
    }
  };

  if (metricsEnabled) {
    const metricsInterval = setInterval(() => {
      const asrSummary = formatLatencySummary('asr_roundtrip', latencyMetrics.asrRoundTripMs);
      const partialSummary = formatLatencySummary(
        'chunk_to_partial',
        latencyMetrics.chunkToPartialMs,
      );
      const finalSummary = formatLatencySummary('chunk_to_final', latencyMetrics.chunkToFinalMs);

      if (
        latencyMetrics.asrRoundTripMs.length > 0 ||
        latencyMetrics.chunkToPartialMs.length > 0 ||
        latencyMetrics.chunkToFinalMs.length > 0
      ) {
        console.info(`[transcription:metrics] ${asrSummary} | ${partialSummary} | ${finalSummary}`);
      }

      latencyMetrics = createLatencyMetricBuckets();
    }, METRICS_LOG_INTERVAL_MS);
    metricsInterval.unref?.();
    server.on('close', () => clearInterval(metricsInterval));
  }

  io.use((socket, next) => {
    const authToken = socket.handshake.auth?.token;
    const header = socket.handshake.headers.authorization;
    const headerToken =
      typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;
    const token = authToken || headerToken;

    if (!token) return next(new Error('Unauthorized'));

    const payload = verifyAccessToken(token);
    if (!payload) return next(new Error('Unauthorized'));

    socket.data.providerId = payload.sub;
    return next();
  });

  io.on('connection', (socket) => {
    const providerId = socket.data.providerId as string | undefined;
    console.log(`Socket connected: ${socket.id} provider=${providerId ?? 'unknown'}`);

    const sessions = new Map<string, RecordingSession>();

    const emitStatus = (status: SessionStatus, extra?: Record<string, unknown>) => {
      socket.emit('session:status', { status, ...extra });
    };

    const emitMetricsEvent = (payload: TranscriptMetricEventPayload) => {
      if (!metricsDebugEventsEnabled) return;
      socket.emit('transcript:metrics', payload);
    };

    const selectWindowStrategy = (session: RecordingSession): StreamWindowStrategy => {
      const minBufferMs = config.transcription.streamBufferMsMin;
      const maxBufferMs = Math.max(minBufferMs, config.transcription.streamBufferMsMax);
      const unprocessedMs = Math.max(0, session.totalDurationMs - session.processedAudioMs);

      const lowLatencyTargetMs = clamp(LOW_LATENCY_BUFFER_TARGET_MS, minBufferMs, maxBufferMs);
      const relaxedTargetMs = clamp(RELAXED_BUFFER_TARGET_MS, minBufferMs, maxBufferMs);
      const backlogWindowCount = Math.floor(unprocessedMs / Math.max(1, lowLatencyTargetMs));
      const backlogThreshold = Math.max(2, Math.ceil(config.transcription.asrQueueMax / 2));
      const isBacklogged = backlogWindowCount >= backlogThreshold;
      const inSilenceMode = session.silenceDurationMs >= SILENCE_MODE_THRESHOLD_MS;

      if (isBacklogged || inSilenceMode) {
        return {
          mode: 'relaxed',
          targetBufferMs: relaxedTargetMs,
          isBacklogged,
        };
      }

      return {
        mode: 'low_latency',
        targetBufferMs: lowLatencyTargetMs,
        isBacklogged,
      };
    };

    const maybeEmitNoSpeechHeartbeat = (
      session: RecordingSession,
      strategy: StreamWindowStrategy,
      reason: 'chunk' | 'silence_window',
    ) => {
      if (session.silenceDurationMs < SILENCE_MODE_THRESHOLD_MS) {
        return;
      }

      const now = Date.now();
      if (now - session.lastNoSpeechHeartbeatAtMs < NO_SPEECH_HEARTBEAT_INTERVAL_MS) {
        return;
      }
      session.lastNoSpeechHeartbeatAtMs = now;

      emitStatus('no_speech', {
        encounterId: session.encounterId,
        sessionId: session.encounterId,
        silenceMs: session.silenceDurationMs,
        mode: strategy.mode,
        targetBufferMs: strategy.targetBufferMs,
        reason,
      });
    };

    const getChunkToTranscriptLatencyMs = (
      session: RecordingSession,
      transcriptEmitAtMs: number,
    ) => {
      const clientCapturedAtMs = session.latestChunkTiming?.clientCapturedAtMs;
      if (!clientCapturedAtMs) return null;
      const latencyMs = transcriptEmitAtMs - clientCapturedAtMs;
      if (!Number.isFinite(latencyMs) || latencyMs < 0) return null;
      return Math.round(latencyMs);
    };

    const emitTranscriptUpdate = (
      session: RecordingSession,
      payload: Omit<TranscriptUpdatePayload, 'latencyMs'>,
    ) => {
      const transcriptEmitAtMs = Date.now();
      const chunkToTranscriptMs = getChunkToTranscriptLatencyMs(session, transcriptEmitAtMs);

      const updatePayload: TranscriptUpdatePayload = {
        ...payload,
      };
      if (metricsEnabled && chunkToTranscriptMs !== null) {
        updatePayload.latencyMs = chunkToTranscriptMs;
      }

      socket.emit('transcript:update', updatePayload);

      if (chunkToTranscriptMs !== null) {
        recordLatencyMetric(
          payload.isFinal ? 'chunkToFinalMs' : 'chunkToPartialMs',
          chunkToTranscriptMs,
        );
      }

      emitMetricsEvent({
        stage: 'transcript_emitted',
        sessionId: payload.sessionId,
        sequence: payload.sequence,
        isFinal: payload.isFinal,
        clientCapturedAtMs: session.latestChunkTiming?.clientCapturedAtMs ?? null,
        clientSentAtMs: session.latestChunkTiming?.clientSentAtMs ?? null,
        serverReceivedAtMs: session.latestChunkTiming?.serverReceivedAtMs,
        asrRequestStartAtMs: session.latestAsrTiming?.asrRequestStartAtMs,
        asrResponseAtMs: session.latestAsrTiming?.asrResponseAtMs,
        transcriptEmitAtMs,
        asrRoundTripMs: session.latestAsrTiming?.asrRoundTripMs,
        chunkToTranscriptMs: chunkToTranscriptMs ?? undefined,
      });
    };

    const emitPartialSegment = (session: RecordingSession, incomingSegment: TranscriptSegment) => {
      if (incomingSegment.end * 1000 <= session.finalizedEndMs + MIN_NEW_SEGMENT_MS) {
        return;
      }

      if (session.partialSegment && isSegmentRelated(session.partialSegment, incomingSegment)) {
        const unchanged =
          session.partialSegment.text === incomingSegment.text &&
          Math.abs(session.partialSegment.start - incomingSegment.start) < 0.05 &&
          Math.abs(session.partialSegment.end - incomingSegment.end) < 0.05;

        if (unchanged) {
          return;
        }

        session.partialSegment = {
          ...incomingSegment,
          sequence: session.partialSegment.sequence,
        };

        emitTranscriptUpdate(session, {
          sessionId: session.encounterId,
          sequence: session.partialSegment.sequence,
          text: incomingSegment.text,
          isFinal: false,
          start: incomingSegment.start,
          end: incomingSegment.end,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      session.transcriptSequence += 1;
      session.partialSegment = {
        ...incomingSegment,
        sequence: session.transcriptSequence,
      };

      emitTranscriptUpdate(session, {
        sessionId: session.encounterId,
        sequence: session.partialSegment.sequence,
        text: incomingSegment.text,
        isFinal: false,
        start: incomingSegment.start,
        end: incomingSegment.end,
        timestamp: new Date().toISOString(),
      });
    };

    const mergeOrAppendFinalSegment = (
      session: RecordingSession,
      incomingSegment: TranscriptSegment,
    ) => {
      if (incomingSegment.end * 1000 <= session.finalizedEndMs + MIN_NEW_SEGMENT_MS) {
        return;
      }

      const lastFinalSegment = session.finalizedSegments[session.finalizedSegments.length - 1];
      if (lastFinalSegment && isSegmentRelated(lastFinalSegment, incomingSegment)) {
        const previousText = lastFinalSegment.text;
        const previousEnd = lastFinalSegment.end;

        if (
          normalizeText(incomingSegment.text).length > normalizeText(lastFinalSegment.text).length
        ) {
          lastFinalSegment.text = incomingSegment.text;
        }
        lastFinalSegment.end = Math.max(lastFinalSegment.end, incomingSegment.end);

        session.finalizedEndMs = Math.max(session.finalizedEndMs, lastFinalSegment.end * 1000);

        if (lastFinalSegment.text !== previousText || lastFinalSegment.end !== previousEnd) {
          emitTranscriptUpdate(session, {
            sessionId: session.encounterId,
            sequence: lastFinalSegment.sequence,
            text: lastFinalSegment.text,
            isFinal: true,
            start: lastFinalSegment.start,
            end: lastFinalSegment.end,
            timestamp: new Date().toISOString(),
          });
        }
        return;
      }

      let sequence: number;
      if (session.partialSegment && isSegmentRelated(session.partialSegment, incomingSegment)) {
        sequence = session.partialSegment.sequence;
        session.partialSegment = null;
      } else {
        session.transcriptSequence += 1;
        sequence = session.transcriptSequence;
      }

      const finalizedSegment: EmittedTranscriptSegment = {
        ...incomingSegment,
        sequence,
      };
      session.finalizedSegments.push(finalizedSegment);
      session.finalizedEndMs = Math.max(session.finalizedEndMs, finalizedSegment.end * 1000);

      emitTranscriptUpdate(session, {
        sessionId: session.encounterId,
        sequence,
        text: finalizedSegment.text,
        isFinal: true,
        start: finalizedSegment.start,
        end: finalizedSegment.end,
        timestamp: new Date().toISOString(),
      });
    };

    const processStreamingTranscription = async (session: RecordingSession) => {
      const strategy = selectWindowStrategy(session);
      const unprocessedMs = session.totalDurationMs - session.processedAudioMs;
      if (unprocessedMs < strategy.targetBufferMs) {
        return;
      }

      const pendingWindows = Math.floor(unprocessedMs / strategy.targetBufferMs);
      if (pendingWindows > config.transcription.asrQueueMax) {
        // Backpressure: skip stale windows and jump to newest region.
        session.processedAudioMs = Math.max(0, session.totalDurationMs - strategy.targetBufferMs);
        // Drop outdated partials, keep finalized merge behavior.
        session.partialSegment = null;
      }

      const windowStartMs = isWebmMimeType(session.mimeType)
        ? 0
        : Math.max(0, session.processedAudioMs - config.transcription.streamOverlapMs);
      const windowEndMs = Math.min(
        session.totalDurationMs,
        session.processedAudioMs + strategy.targetBufferMs,
      );
      const stabilityThresholdMs = Math.max(
        0,
        windowEndMs - config.transcription.streamStabilityMs,
      );
      const selectedWindow = selectChunksForWindow(
        session.streamChunkQueue,
        windowStartMs,
        windowEndMs,
      );
      if (!selectedWindow) {
        session.processedAudioMs = Math.max(session.processedAudioMs, windowEndMs);
        pruneStreamingQueue(session);
        return;
      }

      if (!selectedWindow.speechLikely) {
        session.processedAudioMs = Math.max(session.processedAudioMs, windowEndMs);
        pruneStreamingQueue(session);
        maybeEmitNoSpeechHeartbeat(session, strategy, 'silence_window');

        if (session.totalDurationMs - session.processedAudioMs >= strategy.targetBufferMs) {
          session.pendingProcessing = true;
        }
        return;
      }

      const asrRequestStartAtMs = Date.now();
      let transcription: Awaited<ReturnType<typeof transcribeAudioChunks>>;
      try {
        transcription = await transcribeAudioChunks(selectedWindow.chunks, session.mimeType, {
          model: config.transcription.liveModel,
        });
      } catch (err) {
        if (err instanceof AsrServiceError && isRecoverableAsrWindowError(err)) {
          console.warn('Skipping live window due to recoverable ASR error', {
            encounterId: session.encounterId,
            status: err.status,
            mimeType: session.mimeType ?? null,
            windowStartMs,
            windowEndMs,
          });
          session.processedAudioMs = Math.max(session.processedAudioMs, windowEndMs);
          pruneStreamingQueue(session);

          if (session.totalDurationMs - session.processedAudioMs >= strategy.targetBufferMs) {
            session.pendingProcessing = true;
          }
          return;
        }
        throw err;
      }
      const asrResponseAtMs = Date.now();
      const asrRoundTripMs = Math.max(0, asrResponseAtMs - asrRequestStartAtMs);
      session.latestAsrTiming = {
        asrRequestStartAtMs,
        asrResponseAtMs,
        asrRoundTripMs,
      };
      recordLatencyMetric('asrRoundTripMs', asrRoundTripMs);
      emitMetricsEvent({
        stage: 'asr_roundtrip',
        sessionId: session.encounterId,
        sequence: session.latestChunkTiming?.sequence ?? null,
        clientCapturedAtMs: session.latestChunkTiming?.clientCapturedAtMs ?? null,
        clientSentAtMs: session.latestChunkTiming?.clientSentAtMs ?? null,
        serverReceivedAtMs: session.latestChunkTiming?.serverReceivedAtMs,
        asrRequestStartAtMs,
        asrResponseAtMs,
        asrRoundTripMs,
      });
      const segments = normalizeSegments(transcription.segments).map((segment) =>
        toSessionTimelineSegment(segment, selectedWindow.audioStartMs),
      );

      let partialCandidate: TranscriptSegment | null = null;
      const allowPartialEmission = !strategy.isBacklogged && strategy.mode === 'low_latency';

      for (const segment of segments) {
        const segmentEndMs = segment.end * 1000;

        if (segment.start * 1000 > windowEndMs + config.transcription.streamOverlapMs) {
          break;
        }

        if (segmentEndMs <= session.finalizedEndMs + MIN_NEW_SEGMENT_MS) {
          continue;
        }

        if (segmentEndMs <= stabilityThresholdMs) {
          mergeOrAppendFinalSegment(session, segment);
          continue;
        }

        if (allowPartialEmission) {
          partialCandidate = segment;
        }
      }

      if (partialCandidate) {
        emitPartialSegment(session, partialCandidate);
      } else if (!allowPartialEmission) {
        session.partialSegment = null;
      }

      if (
        session.partialSegment &&
        session.partialSegment.end * 1000 <= session.finalizedEndMs + MIN_NEW_SEGMENT_MS
      ) {
        session.partialSegment = null;
      }

      session.processedAudioMs = Math.max(session.processedAudioMs, windowEndMs);
      pruneStreamingQueue(session);
    };

    const runStreamingPipeline = async (session: RecordingSession) => {
      if (session.isTranscribing || config.transcription.mockUpdates) {
        return;
      }

      session.isTranscribing = true;
      try {
        while (session.pendingProcessing) {
          session.pendingProcessing = false;
          try {
            await processStreamingTranscription(session);
          } catch (err) {
            if (err instanceof AsrServiceError && err.status === 429) {
              const strategy = selectWindowStrategy(session);
              session.processedAudioMs = Math.max(
                0,
                session.totalDurationMs - strategy.targetBufferMs,
              );
              session.partialSegment = null;
              session.pendingProcessing = true;
              continue;
            }
            throw err;
          }
        }
      } catch (err) {
        console.error('Live transcription failed', err);
      } finally {
        session.isTranscribing = false;
        if (session.pendingProcessing) {
          void runStreamingPipeline(session);
        }
      }
    };

    const queueStreamingPipeline = (session: RecordingSession) => {
      if (config.transcription.mockUpdates) {
        return;
      }

      const strategy = selectWindowStrategy(session);
      const hasEnoughAudio =
        session.totalDurationMs - session.processedAudioMs >= strategy.targetBufferMs;
      if (!hasEnoughAudio) {
        return;
      }

      session.pendingProcessing = true;
      void runStreamingPipeline(session);
    };

    emitStatus('connected');

    socket.on('session:start', async (payload?: SessionStartPayload) => {
      if (!providerId) {
        emitStatus('error', { message: 'Missing provider context' });
        return;
      }

      const providerSpeaker =
        typeof payload?.providerSpeaker === 'string' && payload.providerSpeaker.trim().length > 0
          ? payload.providerSpeaker.trim()
          : 'SPEAKER_0';
      const patientSpeaker =
        typeof payload?.patientSpeaker === 'string' && payload.patientSpeaker.trim().length > 0
          ? payload.patientSpeaker.trim()
          : 'SPEAKER_1';

      try {
        const encounter = await prisma.encounter.create({
          data: {
            providerId,
            status: 'recording',
            speakerAssignments: {
              providerSpeaker,
              patientSpeaker,
              providerConfirmed: payload?.providerConfirmed === true,
              calibrationPhrase:
                typeof payload?.calibrationPhrase === 'string'
                  ? payload.calibrationPhrase.trim()
                  : null,
              capturedAt: new Date().toISOString(),
            },
          },
        });

        sessions.set(socket.id, {
          providerId,
          encounterId: encounter.id,
          chunks: [],
          streamChunkQueue: [],
          startedAt: Date.now(),
          transcriptSequence: 0,
          totalDurationMs: 0,
          processedAudioMs: 0,
          isTranscribing: false,
          pendingProcessing: false,
          finalizedSegments: [],
          finalizedEndMs: 0,
          partialSegment: null,
          silenceDurationMs: 0,
          lastNoSpeechHeartbeatAtMs: 0,
          latestInputLevel: null,
          latestChunkTiming: null,
          latestAsrTiming: null,
        });

        emitStatus('start_ack', {
          sessionId: encounter.id,
          encounterId: encounter.id,
          startedAt: encounter.startedAt,
        });
      } catch (err) {
        console.error('Failed to create encounter for session', err);
        emitStatus('error', { message: 'Failed to start session' });
      }
    });

    socket.on('session:pause', () => {
      emitStatus('pause_ack');
    });

    socket.on('session:resume', () => {
      emitStatus('resume_ack');
    });

    socket.on('session:end', async () => {
      const session = sessions.get(socket.id);
      if (!session) {
        emitStatus('error', { message: 'No active session' });
        return;
      }

      try {
        const result = await saveAudioFile(session.chunks, session.mimeType);
        await prisma.encounter.update({
          where: { id: session.encounterId },
          data: {
            status: 'processing',
            endedAt: new Date(),
            audioFilePath: result.filePath,
          },
        });
        emitStatus('end_ack', {
          sessionId: session.encounterId,
          encounterId: session.encounterId,
          filePath: result.filePath,
          bytes: result.bytes,
        });
      } catch (err) {
        console.error('Failed to save audio file', err);
        emitStatus('error', { message: 'Failed to save audio file' });
      } finally {
        sessions.delete(socket.id);
      }
    });

    socket.on('audio:chunk', (payload?: AudioChunkPayload) => {
      const session = sessions.get(socket.id);
      if (!session) {
        emitStatus('error', { message: 'No active session' });
        return;
      }

      const serverReceivedAtMs = Date.now();
      session.latestChunkTiming = {
        sequence: typeof payload?.sequence === 'number' ? payload.sequence : null,
        clientCapturedAtMs: sanitizeClientTimestampMs(payload?.clientCapturedAtMs),
        clientSentAtMs: sanitizeClientTimestampMs(payload?.clientSentAtMs),
        serverReceivedAtMs,
      };
      emitMetricsEvent({
        stage: 'chunk_received',
        sessionId: session.encounterId,
        sequence: session.latestChunkTiming.sequence,
        clientCapturedAtMs: session.latestChunkTiming.clientCapturedAtMs,
        clientSentAtMs: session.latestChunkTiming.clientSentAtMs,
        serverReceivedAtMs,
      });

      if (payload?.mimeType && !session.mimeType) {
        session.mimeType = payload.mimeType;
      }

      const chunkBuffer = toChunkBuffer(payload?.data);
      if (chunkBuffer && chunkBuffer.length > 0) {
        const chunkDurationMs = sanitizeChunkDurationMs(payload?.durationMs);
        const inputLevel = sanitizeInputLevel(payload?.inputLevel);
        const speechLikely =
          typeof payload?.speechLikely === 'boolean'
            ? payload.speechLikely
            : inputLevel === null
              ? true
              : inputLevel >= SPEECH_LEVEL_THRESHOLD;
        const wasSilent = session.silenceDurationMs >= SILENCE_MODE_THRESHOLD_MS;

        session.latestInputLevel = inputLevel;
        if (speechLikely) {
          session.silenceDurationMs = 0;
          if (wasSilent) {
            const strategy = selectWindowStrategy(session);
            emitStatus('speech_detected', {
              encounterId: session.encounterId,
              sessionId: session.encounterId,
              mode: strategy.mode,
              targetBufferMs: strategy.targetBufferMs,
            });
          }
        } else {
          session.silenceDurationMs += chunkDurationMs;
        }

        const chunkStartMs = session.totalDurationMs;
        const chunkEndMs = chunkStartMs + chunkDurationMs;
        session.chunks.push(chunkBuffer);
        session.streamChunkQueue.push({
          buffer: chunkBuffer,
          durationMs: chunkDurationMs,
          startMs: chunkStartMs,
          endMs: chunkEndMs,
          speechLikely,
        });
        session.totalDurationMs = chunkEndMs;
        pruneStreamingQueue(session);

        if (!speechLikely) {
          const strategy = selectWindowStrategy(session);
          maybeEmitNoSpeechHeartbeat(session, strategy, 'chunk');
        }
      }

      emitStatus('chunk_ack', { sequence: payload?.sequence ?? null });

      if (config.transcription.mockUpdates && typeof payload?.sequence === 'number') {
        if (payload.sequence % 6 === 0) {
          const mockIndex = session.transcriptSequence % MOCK_TRANSCRIPT_SEGMENTS.length;
          const segmentText = MOCK_TRANSCRIPT_SEGMENTS[mockIndex];
          session.transcriptSequence += 1;
          emitTranscriptUpdate(session, {
            sessionId: session.encounterId,
            sequence: session.transcriptSequence,
            text: segmentText,
            isFinal: false,
            start: Math.max(0, session.totalDurationMs / 1000 - 2),
            end: session.totalDurationMs / 1000,
            timestamp: new Date().toISOString(),
          });
        }
        return;
      }

      queueStreamingPipeline(session);
    });

    socket.on('disconnect', (reason) => {
      sessions.delete(socket.id);
      console.log(`Socket disconnected: ${socket.id} reason=${reason}`);
    });
  });

  return io;
}
