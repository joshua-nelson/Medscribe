import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';
import { TranscriptSegment } from './transcriptionService';

type DiarizationSegment = {
  speaker: string;
  start: number;
  end: number;
};

type DiarizationResponse = {
  segments: DiarizationSegment[];
};

export type SpeakerRole = 'Provider' | 'Patient' | 'Speaker';

export type SpeakerAnnotatedSegment = TranscriptSegment & {
  speaker: string;
  speakerRole: SpeakerRole;
};

type SpeakerAssignments = {
  providerSpeaker: string;
  patientSpeaker: string;
};

function normalizeDiarizationUrl(url: string | null) {
  if (!url) return null;
  return url.replace(/\/$/, '');
}

function shouldRetryStatus(status: number) {
  return status >= 500 || status === 429;
}

async function sleep(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
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
  buildInit: () => RequestInit,
  timeoutMs: number,
  retries: number,
) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetchWithTimeout(url, buildInit(), timeoutMs);
    if (response.ok || !shouldRetryStatus(response.status) || attempt === retries) {
      return response;
    }
    await sleep(Math.min(250 * (attempt + 1), 1000));
  }

  throw new Error('Diarization request failed');
}

function toRole(speaker: string, assignments: SpeakerAssignments): SpeakerRole {
  if (speaker === assignments.providerSpeaker) return 'Provider';
  if (speaker === assignments.patientSpeaker) return 'Patient';
  return 'Speaker';
}

function overlapSeconds(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function pickSpeakerForSegment(
  segment: TranscriptSegment,
  diarizationSegments: DiarizationSegment[],
) {
  const overlapsBySpeaker = new Map<string, number>();

  for (const diarizationSegment of diarizationSegments) {
    const overlap = overlapSeconds(
      segment.start,
      segment.end,
      diarizationSegment.start,
      diarizationSegment.end,
    );

    if (overlap <= 0) continue;
    const running = overlapsBySpeaker.get(diarizationSegment.speaker) || 0;
    overlapsBySpeaker.set(diarizationSegment.speaker, running + overlap);
  }

  let selectedSpeaker: string | null = null;
  let maxOverlap = 0;
  for (const [speaker, overlap] of overlapsBySpeaker.entries()) {
    if (overlap > maxOverlap) {
      maxOverlap = overlap;
      selectedSpeaker = speaker;
    }
  }

  return selectedSpeaker;
}

export async function diarizeAudioFile(audioPath: string): Promise<DiarizationResponse | null> {
  const diarizationUrl = normalizeDiarizationUrl(config.diarization.url);
  if (!diarizationUrl) return null;

  const audioBytes = await fs.readFile(audioPath);
  const fileName = path.basename(audioPath);
  const formData = new FormData();
  formData.set(
    'audio_file',
    new Blob([audioBytes], { type: 'application/octet-stream' }),
    fileName,
  );

  const response = await fetchWithRetry(
    `${diarizationUrl}/diarize-file`,
    () => ({
      method: 'POST',
      body: formData,
    }),
    config.diarization.requestTimeoutMs,
    config.diarization.requestRetries,
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as DiarizationResponse;
  return payload;
}

export function annotateTranscriptWithSpeakers(
  transcriptSegments: TranscriptSegment[],
  diarizationSegments: DiarizationSegment[],
  assignments: SpeakerAssignments,
): SpeakerAnnotatedSegment[] {
  const sortedDiarizationSegments = [...diarizationSegments].sort((a, b) => a.start - b.start);
  let lastSpeaker = assignments.providerSpeaker;

  return transcriptSegments.map((segment) => {
    const speaker = pickSpeakerForSegment(segment, sortedDiarizationSegments) || lastSpeaker;
    lastSpeaker = speaker;

    return {
      ...segment,
      speaker,
      speakerRole: toRole(speaker, assignments),
    };
  });
}
