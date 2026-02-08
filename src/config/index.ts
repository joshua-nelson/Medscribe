import { readFileSync } from 'node:fs';

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function readDockerSecret(secretName: string): string | undefined {
  try {
    return readFileSync(`/run/secrets/${secretName}`, 'utf8').trim();
  } catch {
    return undefined;
  }
}

function parsePositiveIntInRange(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = parsePositiveInt(value, fallback);
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseNonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

export const config = {
  jwt: {
    secret:
      readDockerSecret('jwt_secret') || process.env.JWT_SECRET || 'dev-secret-change-in-production',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '30m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  frontend: {
    url: frontendUrl,
  },
  audio: {
    storagePath: process.env.AUDIO_STORAGE_PATH || 'storage/audio',
  },
  transcription: {
    mockUpdates: process.env.MOCK_TRANSCRIPT_UPDATES === 'true',
    streamBufferMs: parsePositiveInt(process.env.STREAM_BUFFER_MS, 3000),
    streamBufferMsMin: parsePositiveIntInRange(process.env.STREAM_BUFFER_MS_MIN, 1200, 500, 10_000),
    streamBufferMsMax: parsePositiveIntInRange(process.env.STREAM_BUFFER_MS_MAX, 3000, 500, 10_000),
    streamOverlapMs: parsePositiveInt(process.env.STREAM_OVERLAP_MS, 1200),
    streamStabilityMs: parsePositiveInt(process.env.STREAM_STABILITY_MS, 900),
    liveModel: process.env.WHISPER_MODEL_LIVE || 'base.en',
    finalModel: process.env.WHISPER_MODEL_FINAL || process.env.WHISPER_MODEL || 'small',
    asrQueueMax: parsePositiveInt(process.env.ASR_QUEUE_MAX, 4),
    asrMaxInflight: parsePositiveInt(process.env.ASR_MAX_INFLIGHT, 2),
    metricsEnabled: parseBoolean(
      process.env.TRANSCRIPTION_METRICS_ENABLED,
      process.env.NODE_ENV !== 'production',
    ),
  },
  diarization: {
    url: process.env.DIARIZATION_URL || null,
    requestTimeoutMs: parsePositiveInt(process.env.DIARIZATION_REQUEST_TIMEOUT_MS, 20_000),
    requestRetries: parseNonNegativeInt(process.env.DIARIZATION_REQUEST_RETRIES, 1),
  },
  isProduction: process.env.NODE_ENV === 'production',
};

if (config.transcription.streamBufferMsMax < config.transcription.streamBufferMsMin) {
  config.transcription.streamBufferMsMax = config.transcription.streamBufferMsMin;
}
