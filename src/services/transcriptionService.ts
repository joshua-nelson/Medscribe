import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { Agent } from 'undici';
import { getExtensionForMime } from '../utils/audioMime';

const execFileAsync = promisify(execFile);
const asrDispatcher = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 60_000,
  connections: 8,
});
const DEFAULT_ASR_TIMEOUT_MS = 15_000;
const DEFAULT_ASR_RETRIES = 1;

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  speakerRole?: 'Provider' | 'Patient' | 'Speaker';
};

export type TranscriptionTiming = {
  requestReceivedAtMs?: number;
  audioDecodedAtMs?: number;
  inferenceStartAtMs?: number;
  inferenceDoneAtMs?: number;
  responseAtMs?: number;
  inferenceLatencyMs?: number;
  totalRequestMs?: number;
};

export type TranscriptionResult = {
  full_text: string;
  segments: TranscriptSegment[];
  language?: string;
  model?: string;
  created_at?: string;
  timing?: TranscriptionTiming;
};

export class AsrServiceError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AsrServiceError';
    this.status = status;
  }
}

type TranscriptionRequestOptions = {
  model?: string;
};

function resolveAudioPath(audioPath: string) {
  return path.isAbsolute(audioPath) ? audioPath : path.resolve(audioPath);
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseNonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function getMimeForFilename(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === '.wav') return 'audio/wav';
  if (extension === '.ogg') return 'audio/ogg';
  if (extension === '.webm') return 'audio/webm';
  return 'application/octet-stream';
}

function getAsrUrl() {
  const asrUrl = process.env.ASR_URL;
  if (!asrUrl) return null;
  return asrUrl.replace(/\/$/, '');
}

function getAsrTimeoutMs() {
  return parsePositiveInt(process.env.ASR_REQUEST_TIMEOUT_MS, DEFAULT_ASR_TIMEOUT_MS);
}

function getAsrRetries() {
  return parseNonNegativeInt(process.env.ASR_REQUEST_RETRIES, DEFAULT_ASR_RETRIES);
}

function isBase64FallbackEnabled() {
  return parseBoolean(process.env.ASR_ENABLE_BASE64_FALLBACK, true);
}

function shouldRetryStatus(status: number) {
  return status >= 500 || status === 429;
}

function canFallbackToBase64(status: number) {
  return [404, 405, 415, 422, 501].includes(status);
}

type AsrFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  dispatcher?: unknown;
};

async function sleep(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: AsrFetchInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    } as RequestInit & { dispatcher?: unknown });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(
  url: string,
  buildInit: () => AsrFetchInit,
  timeoutMs: number,
  retries: number,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, buildInit(), timeoutMs);
      if (response.ok || !shouldRetryStatus(response.status) || attempt === retries) {
        return response;
      }
      await sleep(Math.min(200 * (attempt + 1), 1_000));
      continue;
    } catch (err) {
      lastError = err;
      if (attempt === retries) {
        throw err;
      }
      await sleep(Math.min(200 * (attempt + 1), 1_000));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('ASR request failed');
}

async function parseAsrError(response: Response) {
  const body = await response.text();
  return {
    status: response.status,
    message: `ASR service error: ${response.status} ${body}`,
  };
}

async function requestAsrMultipart(
  asrUrl: string,
  audioBytes: Buffer,
  filename: string,
  mimeType: string,
  modelName: string,
): Promise<Response> {
  const timeoutMs = getAsrTimeoutMs();
  const retries = getAsrRetries();
  return fetchWithRetry(
    `${asrUrl}/transcribe-file`,
    () => {
      const formData = new FormData();
      formData.set('audio_file', new Blob([audioBytes], { type: mimeType }), filename);
      formData.set('model', modelName);
      return {
        method: 'POST',
        body: formData,
        dispatcher: asrDispatcher,
      };
    },
    timeoutMs,
    retries,
  );
}

async function requestAsrBase64(
  asrUrl: string,
  audioBytes: Buffer,
  filename: string,
  modelName: string,
) {
  const timeoutMs = getAsrTimeoutMs();
  const retries = getAsrRetries();
  return fetchWithRetry(
    `${asrUrl}/transcribe`,
    () => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_base64: audioBytes.toString('base64'),
        filename,
        model: modelName,
      }),
      dispatcher: asrDispatcher,
    }),
    timeoutMs,
    retries,
  );
}

async function transcribeWithAsr(
  audioBytes: Buffer,
  filename: string,
  mimeType: string,
  modelName: string,
) {
  const asrUrl = getAsrUrl();
  if (!asrUrl) {
    throw new Error('ASR_URL is required for ASR transcription');
  }

  const multipartResponse = await requestAsrMultipart(
    asrUrl,
    audioBytes,
    filename,
    mimeType,
    modelName,
  );
  if (multipartResponse.ok) {
    return (await multipartResponse.json()) as TranscriptionResult;
  }

  if (isBase64FallbackEnabled() && canFallbackToBase64(multipartResponse.status)) {
    const fallbackResponse = await requestAsrBase64(asrUrl, audioBytes, filename, modelName);
    if (!fallbackResponse.ok) {
      const error = await parseAsrError(fallbackResponse);
      throw new AsrServiceError(error.status, error.message);
    }
    return (await fallbackResponse.json()) as TranscriptionResult;
  }

  const error = await parseAsrError(multipartResponse);
  throw new AsrServiceError(error.status, error.message);
}

export async function transcribeAudioFile(
  audioPath: string,
  options?: TranscriptionRequestOptions,
) {
  const resolvedPath = resolveAudioPath(audioPath);
  const modelName = options?.model || process.env.WHISPER_MODEL || 'small';
  const asrUrl = getAsrUrl();

  if (asrUrl) {
    const audioBytes = await fs.readFile(resolvedPath);
    const filename = path.basename(resolvedPath);
    const mimeType = getMimeForFilename(filename);
    return transcribeWithAsr(audioBytes, filename, mimeType, modelName);
  }

  const scriptPath = path.resolve('services/asr/transcribe.py');

  const { stdout } = await execFileAsync(
    'python3',
    [scriptPath, '--audio-path', resolvedPath, '--model', modelName],
    { maxBuffer: 10 * 1024 * 1024 },
  );

  const parsed = JSON.parse(stdout.trim()) as TranscriptionResult;
  return parsed;
}

export async function transcribeAudioChunks(
  chunks: Buffer[],
  mimeType?: string,
  options?: TranscriptionRequestOptions,
) {
  if (chunks.length === 0) {
    return {
      full_text: '',
      segments: [],
    } satisfies TranscriptionResult;
  }

  const asrUrl = getAsrUrl();
  const extension = getExtensionForMime(mimeType);
  const fileName = `chunk-${Date.now()}-${randomUUID()}${extension}`;
  const modelName = options?.model || process.env.WHISPER_MODEL || 'small';

  if (asrUrl) {
    const audioBytes = Buffer.concat(chunks);
    return transcribeWithAsr(
      audioBytes,
      fileName,
      mimeType || 'application/octet-stream',
      modelName,
    );
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'medscribe-stream-'));
  const filePath = path.join(tmpDir, fileName);

  try {
    await fs.writeFile(filePath, Buffer.concat(chunks));
    return await transcribeAudioFile(filePath, options);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function checkAsrHealth() {
  const asrUrl = getAsrUrl();
  if (!asrUrl) {
    return { status: 'unconfigured' as const };
  }

  const response = await fetchWithRetry(
    `${asrUrl}/health`,
    () => ({
      method: 'GET',
      dispatcher: asrDispatcher,
    }),
    getAsrTimeoutMs(),
    getAsrRetries(),
  );

  if (!response.ok) {
    throw new Error(`ASR health check failed: ${response.status}`);
  }

  const payload = (await response.json()) as { status?: string };
  return { status: payload.status ?? 'unknown' };
}
