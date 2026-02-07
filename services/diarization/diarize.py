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

    audio_path = args.audio_path
    if not os.path.exists(audio_path):
        sys.stderr.write("Audio file not found: %s\n" % audio_path)
        return 1

    payload = diarize_audio(audio_path, args.model)
    sys.stdout.write(json.dumps(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
