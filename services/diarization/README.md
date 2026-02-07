# Diarization Service

This service implements Phase 4.1 speaker diarization using `pyannote.audio`.

## Setup Requirements

1. Accept model licenses on Hugging Face:
   - `pyannote/segmentation-3.0`
   - `pyannote/speaker-diarization-3.1`
2. Set `HUGGINGFACE_HUB_TOKEN` in your environment.

## Endpoints

- `GET /health`
- `POST /diarize` (base64 payload)
- `POST /diarize-file` (multipart upload)

## Output Shape

```json
{
  "segments": [{ "speaker": "SPEAKER_0", "start": 0.0, "end": 5.2 }],
  "overlaps": [{ "start": 1.1, "end": 1.9, "speakers": ["SPEAKER_0", "SPEAKER_1"] }]
}
```

## Verification With Two-Speaker Audio

```bash
curl -X POST "http://localhost:8500/diarize-file" \
  -F "audio_file=@/path/to/two-speaker-sample.wav"
```

Expected: speaker change points and `SPEAKER_*` labels appear in `segments`.
