import type { TranscriptSegment } from './transcriptionService';

export type TimedAudioChunk = {
  buffer: Buffer;
  durationMs: number;
  startMs: number;
  endMs: number;
  speechLikely?: boolean;
};

export type AudioWindowSelection = {
  chunks: Buffer[];
  audioStartMs: number;
  audioEndMs: number;
  speechLikely: boolean;
};

export function selectChunksForWindow(
  queue: TimedAudioChunk[],
  windowStartMs: number,
  windowEndMs: number,
): AudioWindowSelection | null {
  if (!Number.isFinite(windowStartMs) || !Number.isFinite(windowEndMs) || windowEndMs <= windowStartMs) {
    return null;
  }

  const selectedChunks: Buffer[] = [];
  let audioStartMs: number | null = null;
  let audioEndMs: number | null = null;
  let speechLikely = false;

  for (const chunk of queue) {
    if (chunk.endMs <= windowStartMs) {
      continue;
    }
    if (chunk.startMs >= windowEndMs) {
      break;
    }

    if (audioStartMs === null) {
      audioStartMs = chunk.startMs;
    }
    audioEndMs = chunk.endMs;
    selectedChunks.push(chunk.buffer);
    // Missing speech metadata defaults to true for backward compatibility.
    if (chunk.speechLikely !== false) {
      speechLikely = true;
    }
  }

  if (selectedChunks.length === 0 || audioStartMs === null || audioEndMs === null) {
    return null;
  }

  return {
    chunks: selectedChunks,
    audioStartMs,
    audioEndMs,
    speechLikely,
  };
}

export function pruneChunkQueue(queue: TimedAudioChunk[], minRetainedEndMs: number) {
  // Find the first chunk to retain (where endMs > minRetainedEndMs)
  let firstRetainedIndex = 0;
  while (firstRetainedIndex < queue.length && queue[firstRetainedIndex].endMs <= minRetainedEndMs) {
    firstRetainedIndex++;
  }
  
  // Bulk removal: remove all chunks before the first retained index in one operation
  if (firstRetainedIndex > 0) {
    queue.splice(0, firstRetainedIndex);
  }
}

export function toSessionTimelineSegment(
  segment: TranscriptSegment,
  audioStartMs: number,
): TranscriptSegment {
  const offsetSeconds = audioStartMs / 1000;
  return {
    start: segment.start + offsetSeconds,
    end: segment.end + offsetSeconds,
    text: segment.text,
  };
}
