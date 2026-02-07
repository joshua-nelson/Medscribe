import test from 'node:test';
import assert from 'node:assert/strict';

const streamWindow = require('../../src/services/streamWindow.ts') as {
  selectChunksForWindow: (
    queue: Array<{ buffer: Buffer; durationMs: number; startMs: number; endMs: number; speechLikely?: boolean }>,
    windowStartMs: number,
    windowEndMs: number,
  ) => { chunks: Buffer[]; audioStartMs: number; audioEndMs: number; speechLikely: boolean } | null;
  pruneChunkQueue: (
    queue: Array<{ buffer: Buffer; durationMs: number; startMs: number; endMs: number }>,
    minRetainedEndMs: number,
  ) => void;
  toSessionTimelineSegment: (
    segment: { start: number; end: number; text: string },
    audioStartMs: number,
  ) => { start: number; end: number; text: string };
};

test('selectChunksForWindow selects overlapping chunks with leading overlap metadata', () => {
  const queue = [
    { buffer: Buffer.from('a'), durationMs: 1000, startMs: 0, endMs: 1000 },
    { buffer: Buffer.from('b'), durationMs: 1000, startMs: 1000, endMs: 2000 },
    { buffer: Buffer.from('c'), durationMs: 1000, startMs: 2000, endMs: 3000 },
    { buffer: Buffer.from('d'), durationMs: 1000, startMs: 3000, endMs: 4000 },
  ];

  const selected = streamWindow.selectChunksForWindow(queue, 1500, 3200);

  assert.ok(selected);
  assert.equal(selected.audioStartMs, 1000);
  assert.equal(selected.audioEndMs, 4000);
  assert.equal(selected.speechLikely, true);
  assert.deepEqual(selected.chunks.map((chunk) => chunk.toString()), ['b', 'c', 'd']);
});

test('selectChunksForWindow returns null when no chunk overlaps the duration window', () => {
  const queue = [
    { buffer: Buffer.from('a'), durationMs: 500, startMs: 0, endMs: 500 },
    { buffer: Buffer.from('b'), durationMs: 500, startMs: 500, endMs: 1000 },
  ];

  const selected = streamWindow.selectChunksForWindow(queue, 1500, 2000);
  assert.equal(selected, null);
});

test('selectChunksForWindow marks window as silence when all selected chunks are explicit non-speech', () => {
  const queue = [
    { buffer: Buffer.from('a'), durationMs: 500, startMs: 0, endMs: 500, speechLikely: false },
    { buffer: Buffer.from('b'), durationMs: 500, startMs: 500, endMs: 1000, speechLikely: false },
    { buffer: Buffer.from('c'), durationMs: 500, startMs: 1000, endMs: 1500, speechLikely: false },
  ];

  const selected = streamWindow.selectChunksForWindow(queue, 200, 1200);
  assert.ok(selected);
  assert.equal(selected.speechLikely, false);
});

test('pruneChunkQueue removes chunks fully older than retained threshold', () => {
  const queue = [
    { buffer: Buffer.from('a'), durationMs: 500, startMs: 0, endMs: 500 },
    { buffer: Buffer.from('b'), durationMs: 500, startMs: 500, endMs: 1000 },
    { buffer: Buffer.from('c'), durationMs: 500, startMs: 1000, endMs: 1500 },
  ];

  streamWindow.pruneChunkQueue(queue, 1000);

  assert.deepEqual(queue.map((chunk) => chunk.buffer.toString()), ['c']);
});

test('toSessionTimelineSegment offsets relative ASR timestamps to session timeline', () => {
  const segment = streamWindow.toSessionTimelineSegment({ start: 0.2, end: 1.4, text: 'hello' }, 3000);
  assert.equal(segment.start, 3.2);
  assert.equal(segment.end, 4.4);
  assert.equal(segment.text, 'hello');
});
