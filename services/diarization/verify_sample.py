import argparse
import json
import os
import sys

from app import diarize_audio


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio-path", required=True)
    parser.add_argument("--model", default=os.getenv("DIARIZATION_MODEL", "pyannote/speaker-diarization-3.1"))
    args = parser.parse_args()

    if not os.path.exists(args.audio_path):
        sys.stderr.write("Audio file not found: %s\n" % args.audio_path)
        return 1

    payload = diarize_audio(args.audio_path, args.model)
    segments = payload.get("segments", [])
    if not isinstance(segments, list) or not segments:
        sys.stderr.write("No diarization segments returned\n")
        return 2

    required_keys = {"speaker", "start", "end"}
    for segment in segments:
        if not required_keys.issubset(segment.keys()):
            sys.stderr.write("Invalid segment shape: %s\n" % json.dumps(segment))
            return 3

    sys.stdout.write(json.dumps({"status": "ok", "segments": len(segments)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
