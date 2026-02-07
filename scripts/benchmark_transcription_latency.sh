#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  BENCHMARK_ACCESS_TOKEN=<jwt> scripts/benchmark_transcription_latency.sh <audio_sample_path>

Optional env vars:
  SOCKET_URL=http://localhost:3000
  CHUNK_MS=500
  POST_STREAM_WAIT_MS=3000
USAGE
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

if [ "$#" -lt 1 ]; then
  usage
  exit 1
fi

if [ -z "${BENCHMARK_ACCESS_TOKEN:-}" ]; then
  echo "BENCHMARK_ACCESS_TOKEN is required"
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required"
  exit 1
fi

if [ ! -d "frontend/node_modules/socket.io-client" ] && [ ! -d "node_modules/socket.io-client" ]; then
  echo "socket.io-client dependency not found. Install frontend deps first (cd frontend && npm install)."
  exit 1
fi

sample_path="$1"
if [ ! -f "$sample_path" ]; then
  echo "Sample file not found: $sample_path"
  exit 1
fi

socket_url="${SOCKET_URL:-http://localhost:3000}"
chunk_ms="${CHUNK_MS:-500}"
post_stream_wait_ms="${POST_STREAM_WAIT_MS:-3000}"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

# Normalize to a stream-friendly mono opus track and split into fixed-size chunks.
ffmpeg -hide_banner -loglevel error \
  -i "$sample_path" \
  -ar 16000 -ac 1 -c:a libopus \
  -f segment -segment_time "$(awk "BEGIN { printf \"%.3f\", ${chunk_ms}/1000 }")" \
  "$work_dir/chunk-%05d.ogg"

if ! ls "$work_dir"/chunk-*.ogg >/dev/null 2>&1; then
  echo "No chunks were generated from sample"
  exit 1
fi

export BENCHMARK_SAMPLE_DIR="$work_dir"
export BENCHMARK_SOCKET_URL="$socket_url"
export BENCHMARK_CHUNK_MS="$chunk_ms"
export BENCHMARK_POST_STREAM_WAIT_MS="$post_stream_wait_ms"

NODE_PATH="frontend/node_modules:node_modules" node <<'NODE'
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

const sampleDir = process.env.BENCHMARK_SAMPLE_DIR;
const socketUrl = process.env.BENCHMARK_SOCKET_URL;
const chunkMs = Number(process.env.BENCHMARK_CHUNK_MS || 500);
const postStreamWaitMs = Number(process.env.BENCHMARK_POST_STREAM_WAIT_MS || 3000);
const token = process.env.BENCHMARK_ACCESS_TOKEN;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor((Math.max(0, Math.min(100, p)) / 100) * (sorted.length - 1));
  return Math.round(sorted[index]);
}

function summary(values) {
  return {
    count: values.length,
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
  };
}

(async () => {
  const chunkFiles = fs.readdirSync(sampleDir)
    .filter((entry) => entry.startsWith('chunk-') && entry.endsWith('.ogg'))
    .sort((a, b) => a.localeCompare(b));

  const asrRoundTripMs = [];
  const chunkToPartialMs = [];
  const chunkToFinalMs = [];

  const socket = io(socketUrl, {
    auth: token ? { token } : undefined,
    transports: ['websocket'],
    timeout: 10000,
  });

  let startAcked = false;
  let endAcked = false;

  socket.on('session:status', (payload = {}) => {
    if (payload.status === 'start_ack') startAcked = true;
    if (payload.status === 'end_ack') endAcked = true;
  });

  socket.on('transcript:metrics', (payload = {}) => {
    if (typeof payload.asrRoundTripMs === 'number') {
      asrRoundTripMs.push(payload.asrRoundTripMs);
    }
    if (typeof payload.chunkToTranscriptMs === 'number') {
      if (payload.isFinal) {
        chunkToFinalMs.push(payload.chunkToTranscriptMs);
      } else {
        chunkToPartialMs.push(payload.chunkToTranscriptMs);
      }
    }
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('socket connect timeout')), 10000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  socket.emit('session:start');
  for (let i = 0; i < 40 && !startAcked; i += 1) {
    await sleep(100);
  }
  if (!startAcked) {
    throw new Error('start_ack timeout');
  }

  for (let i = 0; i < chunkFiles.length; i += 1) {
    const filePath = path.join(sampleDir, chunkFiles[i]);
    const data = fs.readFileSync(filePath);
    const clientCapturedAtMs = Date.now();
    socket.emit('audio:chunk', {
      sequence: i,
      mimeType: 'audio/ogg',
      durationMs: chunkMs,
      clientCapturedAtMs,
      clientSentAtMs: Date.now(),
      data,
    });
    await sleep(chunkMs);
  }

  await sleep(postStreamWaitMs);
  socket.emit('session:end');
  for (let i = 0; i < 100 && !endAcked; i += 1) {
    await sleep(100);
  }

  socket.disconnect();

  const output = {
    socketUrl,
    chunkCount: chunkFiles.length,
    chunkMs,
    asrRoundTrip: summary(asrRoundTripMs),
    chunkToPartial: summary(chunkToPartialMs),
    chunkToFinal: summary(chunkToFinalMs),
    collectedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(output, null, 2));
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
NODE
