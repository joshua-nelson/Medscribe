# Parakeet ASR Engine Migration Guide

## Overview

MedScribe now supports NVIDIA Parakeet TDT 0.6B v3 as an alternative ASR engine alongside OpenAI Whisper and faster-whisper. Parakeet offers significant performance improvements for on-premise CPU deployments.

## Performance Comparison

| Metric                      | Parakeet TDT 0.6B | Whisper Large V3 | Improvement      |
| --------------------------- | ----------------- | ---------------- | ---------------- |
| **RTFx (CPU)**              | 3386×             | 216×             | **15.7× faster** |
| **WER (LibriSpeech clean)** | 1.93%             | 2.5%             | **23% better**   |
| **WER (Average)**           | 6.34%             | 10-12%           | **37% better**   |
| **Memory (int8)**           | 2GB               | ~3GB             | **33% less**     |
| **Latency (30s audio)**     | ~200-400ms        | ~2-3s            | **6-10× faster** |
| **Model Size**              | 670MB             | 1.5GB            | **55% smaller**  |

## Engine Selection

### Option 1: Parakeet (Recommended for Production)

**Advantages:**

- ✅ **15× faster** transcription on CPU
- ✅ **Better accuracy** on English medical conversations
- ✅ **Lower memory** footprint (2GB vs 3GB)
- ✅ **Word-level timestamps** (more accurate than Whisper)
- ✅ **Automatic punctuation** and capitalization
- ✅ **CPU-optimized** architecture

**Limitations:**

- ⚠️ 25 European languages only (vs Whisper's 99+)
- ⚠️ Newer model (released 2025, smaller ecosystem)
- ⚠️ First request downloads 670MB-2.6GB model

**Best for:**

- Real-time transcription
- High-throughput batch processing
- On-premise CPU-only deployments
- English medical encounters

### Option 2: Faster Whisper

**Advantages:**

- ✅ Faster than OpenAI Whisper (5-10×)
- ✅ 99+ languages supported
- ✅ Mature ecosystem with many integrations

**Best for:**

- Multilingual support beyond European languages
- Familiarity with Whisper model behavior
- Existing Whisper-based workflows

### Option 3: OpenAI Whisper (Baseline)

**Advantages:**

- ✅ Reference implementation
- ✅ Maximum language coverage

**Best for:**

- Development/testing only
- Legacy compatibility

## Configuration

### Environment Variables

Add to `.env`:

```bash
# ASR Engine Selection
# Options: openai_whisper, faster_whisper, parakeet
ASR_ENGINE=parakeet

# Parakeet-specific configuration
PARAKEET_MODEL=nvidia/parakeet-tdt-0.6b-v3

# Whisper fallback configuration (used if Parakeet fails)
WHISPER_MODEL_LIVE=base.en
WHISPER_MODEL_FINAL=small

# Shared configuration
ASR_COMPUTE_TYPE=int8
ASR_MAX_INFLIGHT=2
ASR_QUEUE_MAX=4
ASR_QUEUE_TIMEOUT_MS=2500
```

### Docker Compose

The ASR service automatically uses the `ASR_ENGINE` environment variable:

```yaml
services:
  asr:
    build: ./services/asr
    environment:
      - ASR_ENGINE=${ASR_ENGINE:-openai_whisper}
      - PARAKEET_MODEL=${PARAKEET_MODEL:-nvidia/parakeet-tdt-0.6b-v3}
```

## Migration Steps

### 1. Update Configuration

Edit `.env`:

```bash
ASR_ENGINE=parakeet
PARAKEET_MODEL=nvidia/parakeet-tdt-0.6b-v3
```

### 2. Rebuild ASR Service

```bash
docker compose build asr
```

**Note:** First build will take 5-10 minutes due to NeMo dependencies.

### 3. Restart Services

```bash
docker compose down
docker compose up -d
```

### 4. Verify Engine

Check ASR service health:

```bash
curl http://localhost/api/transcriptions/health
```

Expected response:

```json
{
  "status": "ok",
  "engine": "parakeet",
  "computeType": "int8",
  "maxInflight": 2,
  "queueDepth": 0,
  "queueMax": 4
}
```

### 5. Test Transcription

Upload a test audio file:

```bash
curl -X POST http://localhost/api/transcriptions/transcribe-file \
  -H "Authorization: Bearer $TOKEN" \
  -F "audio_file=@test_audio.wav" \
  -F "model=nvidia/parakeet-tdt-0.6b-v3"
```

Expected response includes:

```json
{
  "full_text": "...",
  "segments": [...],
  "language": "en",
  "model": "nvidia/parakeet-tdt-0.6b-v3",
  "engine": "parakeet",
  "timing": {
    "inferenceLatencyMs": 250
  }
}
```

## Troubleshooting

### First Request is Slow

**Symptom:** Initial transcription takes 30-60 seconds

**Cause:** Model download (670MB for int8 quantized)

**Solution:**

```bash
# Pre-download model by warming up the cache
docker compose exec asr python -c "
import nemo.collections.asr as nemo_asr
model = nemo_asr.models.ASRModel.from_pretrained('nvidia/parakeet-tdt-0.6b-v3')
print('Model cached successfully')
"
```

### Fallback to Whisper

**Symptom:** Response shows `"engine": "faster_whisper"` instead of `"parakeet"`

**Cause:** Parakeet failed to load or transcribe

**Check logs:**

```bash
docker compose logs asr --tail 100 | grep -i error
```

**Common issues:**

- Insufficient memory (requires 2GB+ RAM)
- Model download failure (check internet connection)
- Audio format incompatibility (Parakeet expects 16kHz mono WAV)

### Memory Pressure

**Symptom:** OOM errors or service crashes

**Current limits:**

- Parakeet int8: ~2GB per concurrent job
- Max concurrent: `ASR_MAX_INFLIGHT=2` → 4GB total

**Solution:**
Reduce concurrency or increase RAM:

```bash
# In .env
ASR_MAX_INFLIGHT=1  # Reduce to 1 concurrent job (2GB total)
```

## API Compatibility

### Request Format

**No changes required** - all engines use the same API:

```bash
POST /api/transcriptions/transcribe-file
Content-Type: multipart/form-data

Fields:
  audio_file: <audio file>
  model: <model name>  # Optional, uses PARAKEET_MODEL env var if omitted
```

### Response Format

**No changes required** - response schema is engine-agnostic:

```typescript
{
  full_text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  language: string;
  model: string;
  engine: 'openai_whisper' | 'faster_whisper' | 'parakeet';
  created_at: string;
  timing: {
    inferenceLatencyMs: number;
    totalRequestMs: number;
  }
}
```

## Performance Tuning

### Concurrency

Parakeet is **fast enough** to reduce queue depth:

```bash
# Recommended for Parakeet (fast inference)
ASR_MAX_INFLIGHT=3  # Up to 3 concurrent jobs
ASR_QUEUE_MAX=2     # Lower queue (less waiting)
```

```bash
# Previous settings for Whisper (slow inference)
ASR_MAX_INFLIGHT=2
ASR_QUEUE_MAX=4
```

### Queue Timeout

Reduce timeout for faster failure detection:

```bash
# Parakeet transcribes much faster
ASR_QUEUE_TIMEOUT_MS=1000  # 1 second (down from 2.5s)
```

## Supported Languages

Parakeet TDT 0.6B v3 supports **25 European languages**:

| Code | Language    | Code | Language   |
| ---- | ----------- | ---- | ---------- |
| `bg` | Bulgarian   | `nl` | Dutch      |
| `hr` | Croatian    | `pl` | Polish     |
| `cs` | Czech       | `pt` | Portuguese |
| `da` | Danish      | `ro` | Romanian   |
| `de` | German      | `sk` | Slovak     |
| `el` | Greek       | `sl` | Slovenian  |
| `en` | **English** | `es` | Spanish    |
| `et` | Estonian    | `sv` | Swedish    |
| `fi` | Finnish     | `ru` | Russian    |
| `fr` | French      | `uk` | Ukrainian  |
| `hu` | Hungarian   |      |            |
| `it` | Italian     |      |            |
| `lv` | Latvian     |      |            |
| `lt` | Lithuanian  |      |            |
| `mt` | Maltese     |      |            |

**Language Detection:** Automatic (no prompting required)

**For languages outside this list:** Use `ASR_ENGINE=faster_whisper` for broader language support.

## Rollback Procedure

If you need to revert to Whisper:

### 1. Update `.env`

```bash
ASR_ENGINE=faster_whisper  # or openai_whisper
```

### 2. Restart ASR Service

```bash
docker compose restart asr
```

**No rebuild required** - Whisper dependencies are already installed.

## Production Deployment Checklist

- [ ] Set `ASR_ENGINE=parakeet` in production `.env`
- [ ] Pre-download model during deployment (see Troubleshooting)
- [ ] Tune concurrency based on server RAM (3-4 concurrent for 32GB)
- [ ] Monitor first-request latency (model download)
- [ ] Set up health check monitoring (`/api/transcriptions/health`)
- [ ] Test fallback to Whisper (simulate Parakeet failure)
- [ ] Benchmark end-to-end latency on production hardware
- [ ] Verify medical terminology accuracy (consider fine-tuning)

## Future Improvements

### ONNX Runtime Conversion (Phase 15)

For **maximum CPU performance** in production:

1. Convert Parakeet to ONNX format (int8 quantized)
2. Use `onnxruntime` instead of NeMo (lighter dependencies)
3. Expected gains:
   - 20-30% faster inference
   - 50% less memory (1GB vs 2GB)
   - Smaller Docker image (removes PyTorch)

**Implementation:**

```bash
# Convert to ONNX (one-time)
python convert_parakeet_to_onnx.py

# Update ASR service to use ONNX runtime
pip install onnxruntime sherpa-onnx
```

Pre-converted ONNX models available at:

- https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx

### Medical Fine-Tuning (Phase 6+)

Parakeet can be fine-tuned on medical terminology:

1. Collect medical encounter transcripts (500-1000 hours)
2. Fine-tune Parakeet TDT on MedScribe data
3. Expected WER improvement: 2-3% on medical terms

**Benefits:**

- Better recognition of drug names, procedures, diagnoses
- Reduced hallucinations on medical jargon
- Maintained 15× speed advantage

## References

- [Parakeet HuggingFace](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)
- [NeMo Documentation](https://docs.nvidia.com/nemo-framework/user-guide/latest/)
- [Technical Report](https://arxiv.org/abs/2509.14128)
- [ONNX Models](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx)

## Support

For issues with Parakeet integration:

1. Check logs: `docker compose logs asr --tail 200`
2. Verify health: `curl http://localhost/api/transcriptions/health`
3. Test fallback: Set `ASR_ENGINE=faster_whisper` temporarily
4. Report model-specific issues to NVIDIA NeMo GitHub
