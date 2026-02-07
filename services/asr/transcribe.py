import argparse
import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List


def mock_transcription(audio_path: str) -> Dict[str, Any]:
    basename = os.path.basename(audio_path)
    segments = [
        {"start": 0.0, "end": 2.8, "text": "Mock transcript for %s." % basename},
        {"start": 2.8, "end": 5.2, "text": "Replace with Whisper output when installed."},
    ]
    full_text = " ".join(segment["text"] for segment in segments)
    return {
        "full_text": full_text,
        "segments": segments,
        "language": "en",
        "model": "mock",
        "created_at": datetime.utcnow().isoformat() + "Z",
    }


def whisper_transcription(audio_path: str, model_name: str) -> Dict[str, Any]:
    try:
        import whisper  # type: ignore
    except Exception:
        return mock_transcription(audio_path)

    model = whisper.load_model(model_name)
    result = model.transcribe(audio_path)
    segments: List[Dict[str, Any]] = []
    for segment in result.get("segments", []):
        segments.append(
            {
                "start": float(segment.get("start", 0.0)),
                "end": float(segment.get("end", 0.0)),
                "text": (segment.get("text") or "").strip(),
            }
        )

    full_text = (result.get("text") or "").strip()
    return {
        "full_text": full_text,
        "segments": segments,
        "language": result.get("language", "en"),
        "model": model_name,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio-path", required=True)
    parser.add_argument("--model", default="small")
    args = parser.parse_args()

    audio_path = args.audio_path
    if not os.path.exists(audio_path):
        sys.stderr.write("Audio file not found: %s\n" % audio_path)
        return 1

    payload = whisper_transcription(audio_path, args.model)
    sys.stdout.write(json.dumps(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
