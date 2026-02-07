# Transcription Latency Benchmark

This benchmark replays a fixed prerecorded sample into the live Socket.IO ingestion path and captures telemetry emitted by `transcript:metrics`.

## Prerequisites

- Backend running locally (default `http://localhost:3000`)
- Frontend dependencies installed (`cd frontend && npm install`) so `socket.io-client` is available
- `ffmpeg` installed
- A valid provider JWT in `BENCHMARK_ACCESS_TOKEN`
- A fixed clinic-like sample audio file (target: ~5 minutes, mixed speech/silence)

## Run

```bash
BENCHMARK_ACCESS_TOKEN='<provider-jwt>' \
SOCKET_URL='http://localhost:3000' \
CHUNK_MS=500 \
scripts/benchmark_transcription_latency.sh ./path/to/clinic-sample.wav
```

The script prints JSON summary output with p50/p95 for:

- `asrRoundTrip`
- `chunkToPartial`
- `chunkToFinal`

## Baseline Tracking

Record baseline (before optimization phases) and update after each phase.

| Date | Commit | Sample | P50 partial (ms) | P95 partial (ms) | P95 final (ms) | P95 ASR roundtrip (ms) | Notes |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 2026-02-06 | 1278fe2 | `frontend/public/test.mp3` | 421 | 506 | 298 | 16546 | Phase B gate run on local CPU stack (chunk=500ms, wait=4000ms) |

## Notes

- Keep sample file and chunk cadence consistent across runs.
- For reliable comparisons, benchmark on the same host profile and with minimal background load.
- If no metrics appear, verify `TRANSCRIPTION_METRICS_ENABLED=true` in backend env.
