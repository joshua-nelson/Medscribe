# MedScribe Transcription Latency Optimization Plan

**Date:** February 6, 2026  
**Goal:** Minimize end-to-end live transcription latency while preserving usable clinical accuracy.

---

## 1. Current State and Bottlenecks

### 1.1 Current flow
1. Browser sends 500ms chunks over Socket.IO.
2. Backend accumulates chunks and triggers streaming transcription every ~3s.
3. Backend currently retranscribes the entire accumulated session on each cycle.
4. Backend writes temporary audio files for each streaming pass.
5. ASR service receives base64 audio, writes another temp file, and runs Whisper.

### 1.2 Observed bottlenecks
1. **Re-transcribing full history repeatedly** (`src/socket.ts`) causes latency growth over session duration.
2. **Double temp-file I/O** (`src/services/transcriptionService.ts` and `services/asr/app.py`) adds avoidable overhead.
3. **Base64 transport** between backend and ASR adds CPU and memory overhead.
4. **CPU-only openai-whisper** (`openai-whisper` + `WHISPER_MODEL=small`) is slower than optimized CPU inference stacks.
5. **No explicit latency SLO instrumentation** makes tuning blind.

---

## 2. Target SLOs

### 2.1 Latency targets (live path)
1. P50 partial token latency: <= 1.2s
2. P95 partial token latency: <= 2.5s
3. P95 final segment latency: <= 3.5s

### 2.2 Quality/behavior constraints
1. No duplicate lines in UI.
2. Stable partial-to-final upgrades for same sequence ID.
3. Final transcript quality must not regress materially vs current `small` model baseline (manual smoke set).

---

## 3. Optimization Strategy (Implementation Order)

## Phase A: Measure First (No Behavior Change)

### A.1 Add latency telemetry
**Files:** `src/socket.ts`, `frontend/src/components/recording/AudioRecorder.tsx`, `services/asr/app.py`

1. Add timestamps to `audio:chunk` payload:
   - `clientCapturedAtMs`
   - `clientSentAtMs`
2. On backend:
   - mark `serverReceivedAtMs`
   - mark `asrRequestStartAtMs`, `asrResponseAtMs`
   - mark `transcriptEmitAtMs`
3. Emit debug metrics events (`transcript:metrics`) in dev mode only.
4. Log rolling summary every 30s:
   - p50/p95 ASR roundtrip
   - p50/p95 chunk-to-partial
   - p50/p95 chunk-to-final

### A.2 Define benchmark harness
**Files:** add `scripts/benchmark_transcription_latency.sh` and `docs/transcription-benchmark.md`

1. Use fixed prerecorded clinic-like sample (5m mixed speech/silence).
2. Replay chunks at real-time cadence to local stack.
3. Capture median and p95 latencies before and after each phase.

Acceptance for Phase A:
1. Dashboard/log can report p50/p95 for each latency stage.
2. Baseline numbers documented in markdown.

---

## Phase B: Remove Architectural Overhead

### B.1 True sliding window (no full-history retranscribe)
**Files:** `src/socket.ts`

1. Replace `chunkSnapshot = session.chunks.slice()` behavior with bounded audio windows:
   - maintain ring buffer of recent audio only.
   - process `new_audio + overlap` (e.g., 1.2s overlap), not entire encounter.
2. Introduce per-session byte queue metadata:
   - chunk duration ms
   - cumulative timeline
   - map duration window -> subset of chunks.
3. Preserve partial/final merge logic and sequence IDs.

### B.2 Eliminate duplicate temp-file passes
**Files:** `src/services/transcriptionService.ts`, `services/asr/app.py`

1. Change backend->ASR call to multipart binary upload (`audio_file`) instead of JSON base64.
2. ASR endpoint accepts file upload directly and passes path/stream to inference.
3. Keep JSON-base64 endpoint behind fallback flag for compatibility during rollout.

### B.3 Minimize serialization overhead
**Files:** `src/services/transcriptionService.ts`

1. Use keep-alive HTTP agent for ASR requests.
2. Reuse request client with sensible timeouts and retries.

Acceptance for Phase B:
1. Latency no longer increases linearly with recording duration.
2. At least 30% improvement in p95 partial latency from baseline.

---

## Phase C: Faster CPU Inference Stack

### C.1 Introduce faster-whisper backend
**Files:** `services/asr/requirements.txt`, `services/asr/app.py`, `services/asr/Dockerfile`

1. Add `faster-whisper` and supporting runtime deps.
2. Implement backend selector via env:
   - `ASR_ENGINE=openai_whisper|faster_whisper`
3. Default CPU compute type:
   - `ASR_COMPUTE_TYPE=int8`
4. Keep openai-whisper as fallback path.

### C.2 Model split by workload
**Files:** `services/asr/app.py`, backend config/env

1. Live stream model default: `base.en` (or `tiny.en` for very constrained CPU).
2. Final pass model default: `small` (higher accuracy after stop).
3. Add env vars:
   - `WHISPER_MODEL_LIVE`
   - `WHISPER_MODEL_FINAL`

### C.3 ASR worker concurrency controls
**Files:** `services/asr/app.py`, compose/env

1. Add bounded worker pool for ASR requests to avoid CPU thrash.
2. Add queue timeout and backpressure policy:
   - if ASR backlog > threshold, skip intermediate partials and jump to newest window.

Acceptance for Phase C:
1. Additional 30-50% p95 partial latency improvement on CPU-only host.
2. No runaway queue growth under normal 1-session load.

---

## Phase D: Silence-Aware Processing and Adaptive Scheduling

### D.1 Add VAD gate before ASR call
**Files:** `src/socket.ts` or `services/asr/app.py` (prefer ASR side if centralizing logic)

1. Detect silence-only windows and skip transcription calls.
2. Emit heartbeat/no-speech status to keep UI responsive.

### D.2 Adaptive chunk scheduling
**Files:** `src/socket.ts`, frontend recorder

1. Dynamic stream buffer:
   - low-latency mode: 1.2-2.0s during active speech.
   - relaxed mode: 2.5-3.0s during silence or backlog.
2. If ASR is behind:
   - drop stale partial windows, keep finalization windows.

Acceptance for Phase D:
1. Reduced ASR call volume during silence.
2. Stable UX under varying speech cadence without duplicate text.

---

## Phase E: Optional GPU Path (If Available)

### E.1 Add GPU-enabled ASR profile
**Files:** `docker-compose.yml`, optional `docker-compose.gpu.yml`

1. Add optional GPU deployment stanza for ASR service.
2. Set compute type `float16` when GPU present.
3. Keep CPU profile as default for portability.

Acceptance for Phase E:
1. GPU profile can be enabled without code changes.
2. CPU fallback remains fully functional.

---

## 4. Configuration Additions

Add/update env vars:
1. `ASR_ENGINE` (`openai_whisper` | `faster_whisper`)
2. `ASR_COMPUTE_TYPE` (`int8`, `float16`, etc.)
3. `WHISPER_MODEL_LIVE`
4. `WHISPER_MODEL_FINAL`
5. `STREAM_BUFFER_MS_MIN`
6. `STREAM_BUFFER_MS_MAX`
7. `STREAM_OVERLAP_MS`
8. `STREAM_STABILITY_MS`
9. `ASR_MAX_INFLIGHT`
10. `ASR_QUEUE_MAX`
11. `ASR_ENABLE_BASE64_FALLBACK`
12. `TRANSCRIPTION_METRICS_ENABLED`

---

## 5. API/Contract Changes

## 5.1 WebSocket payload additions
`audio:chunk` payload:
1. `clientCapturedAtMs: number`
2. `clientSentAtMs: number`
3. existing fields stay compatible.

`transcript:update` payload:
1. keep `sequence`, `text`, `isFinal`, `start`, `end`
2. optional debug `latencyMs` when metrics enabled

## 5.2 ASR HTTP API
1. New preferred endpoint: `POST /transcribe-file` (multipart/form-data file upload)
2. Legacy endpoint: `POST /transcribe` (base64 JSON) retained temporarily behind flag.

---

## 6. Testing Plan

## 6.1 Unit tests
1. Sliding-window chunk selection logic.
2. Partial/final merge correctness with overlap.
3. Backpressure logic (drop stale partial, keep final windows).
4. VAD silence skip decisions.

## 6.2 Integration tests
1. End-to-end WebSocket stream with fixed audio replay.
2. Verify no duplicate transcript lines.
3. Verify sequence IDs update same segment from partial->final.
4. Verify fallback behavior when ASR times out.

## 6.3 Performance tests
1. 5-minute scripted session, CPU-only:
   - capture p50/p95 partial/final latencies.
2. 15-minute long session soak:
   - ensure latency does not drift upward.
3. Backlog stress:
   - intentionally slow ASR and validate graceful degradation policy.

---

## 7. Rollout Plan

1. Ship Phase A first with metrics-only flags on.
2. Enable Phase B+C optimizations behind feature flags in staging.
3. Run benchmark script and compare against baseline.
4. Enable in production for a small cohort.
5. Monitor:
   - p95 live latency
   - ASR queue depth
   - transcript duplication rate
   - error rate/timeouts
6. Ramp to 100% after 48h stable metrics.

---

## 8. Risks and Mitigations

1. **Accuracy drop with smaller live model**
   - Mitigation: keep higher-quality final pass model.
2. **Complexity increase in stream scheduler**
   - Mitigation: isolate scheduler module + dedicated tests.
3. **Engine migration risk**
   - Mitigation: keep dual-engine fallback until parity validated.
4. **CPU saturation under concurrent sessions**
   - Mitigation: explicit queue/backpressure and max inflight controls.

---

## 9. Definition of Done

1. CPU-only p95 partial latency <= 2.5s in benchmark harness.
2. CPU-only p95 final segment latency <= 3.5s.
3. No duplicate transcript artifacts in integration tests.
4. Latency remains stable over 15-minute session.
5. Rollback path (legacy ASR endpoint + previous engine) documented and tested.
