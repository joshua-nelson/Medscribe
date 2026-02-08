import asyncio
import base64
import os
import shutil
import subprocess
import tempfile
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, TypedDict

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool


class Segment(TypedDict):
    speaker: str
    start: float
    end: float


class Overlap(TypedDict):
    start: float
    end: float
    speakers: List[str]


class DiarizeRequest(BaseModel):
    audio_base64: str
    filename: Optional[str] = None
    model: Optional[str] = None


app = FastAPI()


def parse_positive_int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        parsed = int(raw)
    except ValueError:
        return default
    if parsed <= 0:
        return default
    return parsed


def parse_non_negative_int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        parsed = int(raw)
    except ValueError:
        return default
    if parsed < 0:
        return default
    return parsed


def now_ms() -> int:
    return int(time.time() * 1000)


def convert_to_wav(audio_path: str) -> tuple[str, Optional[str]]:
    temp_dir = tempfile.mkdtemp(prefix="diarize-audio-")
    output_path = os.path.join(temp_dir, "input.wav")

    try:
        subprocess.run(
            [
                "ffmpeg",
                "-nostdin",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                audio_path,
                "-ac",
                "1",
                "-ar",
                "16000",
                "-c:a",
                "pcm_s16le",
                output_path,
            ],
            check=True,
            capture_output=True,
        )
    except Exception as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="Unable to decode audio for diarization") from exc

    return output_path, temp_dir


_PIPELINE_CACHE: Dict[str, Any] = {}


def _load_pipeline(model_name: str) -> Any:
    cache_key = model_name
    if cache_key in _PIPELINE_CACHE:
        return _PIPELINE_CACHE[cache_key]

    token = os.getenv("HUGGINGFACE_HUB_TOKEN") or os.getenv("HF_TOKEN")
    if not token:
        raise HTTPException(
            status_code=503,
            detail="Missing HUGGINGFACE_HUB_TOKEN. Accept pyannote model licenses and set token.",
        )

    try:
        from pyannote.audio import Pipeline  # type: ignore
    except Exception as exc:
        raise HTTPException(status_code=503, detail="pyannote.audio is not installed") from exc

    pipeline = Pipeline.from_pretrained(model_name, use_auth_token=token)

    device = (os.getenv("DIARIZATION_DEVICE") or "").strip().lower()
    if not device:
        device = "cuda" if os.getenv("DIARIZATION_USE_CUDA", "true").lower() == "true" else "cpu"

    if device == "cuda":
        try:
            import torch  # type: ignore

            if torch.cuda.is_available():
                pipeline.to(torch.device("cuda"))
            else:
                pipeline.to(torch.device("cpu"))
        except Exception:
            # Silently fall back if torch is unavailable or CUDA setup fails.
            # The pipeline will remain on its default device (typically CPU).
            pass

    _PIPELINE_CACHE[cache_key] = pipeline
    return pipeline


def _normalize_segments(raw_segments: List[Segment]) -> List[Segment]:
    normalized = [segment for segment in raw_segments if segment["end"] > segment["start"]]
    normalized.sort(key=lambda segment: (segment["start"], segment["end"], segment["speaker"]))
    return normalized


def _detect_overlaps(segments: List[Segment]) -> List[Overlap]:
    overlaps: List[Overlap] = []
    active: List[Segment] = []

    for segment in segments:
        active = [item for item in active if item["end"] > segment["start"]]

        for item in active:
            overlap_start = max(item["start"], segment["start"])
            overlap_end = min(item["end"], segment["end"])
            if overlap_end <= overlap_start:
                continue
            if item["speaker"] == segment["speaker"]:
                continue
            overlaps.append(
                {
                    "start": round(overlap_start, 3),
                    "end": round(overlap_end, 3),
                    "speakers": sorted([item["speaker"], segment["speaker"]]),
                }
            )

        active.append(segment)

    deduped: Dict[tuple[float, float, tuple[str, ...]], Overlap] = {}
    for overlap in overlaps:
        key = (overlap["start"], overlap["end"], tuple(overlap["speakers"]))
        deduped[key] = overlap

    return list(deduped.values())


def diarize_audio(audio_path: str, model_name: str) -> Dict[str, Any]:
    pipeline = _load_pipeline(model_name)
    diarization = pipeline(audio_path)

    raw_segments: List[Segment] = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        raw_segments.append(
            {
                "speaker": str(speaker),
                "start": round(float(turn.start), 3),
                "end": round(float(turn.end), 3),
            }
        )

    segments = _normalize_segments(raw_segments)
    overlaps = _detect_overlaps(segments)

    return {
        "segments": segments,
        "overlaps": overlaps,
        "model": model_name,
        "engine": "pyannote",
        "created_at": datetime.utcnow().isoformat() + "Z",
    }


diarization_model_default = os.getenv("DIARIZATION_MODEL", "pyannote/speaker-diarization-3.1")
diarization_max_inflight = parse_positive_int_env("DIARIZATION_MAX_INFLIGHT", 1)
diarization_queue_max = parse_non_negative_int_env("DIARIZATION_QUEUE_MAX", 2)
diarization_queue_timeout_ms = parse_positive_int_env("DIARIZATION_QUEUE_TIMEOUT_MS", 5000)

diarization_semaphore = asyncio.Semaphore(diarization_max_inflight)
diarization_pending_requests = 0
diarization_pending_lock = asyncio.Lock()


async def run_diarization_job(job: Callable[[], Dict[str, Any]]) -> Dict[str, Any]:
    global diarization_pending_requests

    async with diarization_pending_lock:
        queued_requests = max(0, diarization_pending_requests - diarization_max_inflight)
        if queued_requests >= diarization_queue_max:
            raise HTTPException(status_code=429, detail="Diarization queue overloaded")
        diarization_pending_requests += 1

    acquired = False
    try:
        try:
            await asyncio.wait_for(
                diarization_semaphore.acquire(), timeout=diarization_queue_timeout_ms / 1000
            )
            acquired = True
        except TimeoutError as exc:
            raise HTTPException(status_code=429, detail="Diarization queue timeout") from exc

        return await run_in_threadpool(job)
    finally:
        if acquired:
            diarization_semaphore.release()
        async with diarization_pending_lock:
            diarization_pending_requests = max(0, diarization_pending_requests - 1)


async def diarize_from_audio_path(
    audio_path: str, model_name: str, request_received_at_ms: int, audio_decoded_at_ms: int
) -> Dict[str, Any]:
    inference_start_at_ms = now_ms()
    wav_path, cleanup_dir = convert_to_wav(audio_path)
    try:
        payload = await run_diarization_job(lambda: diarize_audio(wav_path, model_name))
    finally:
        if cleanup_dir:
            shutil.rmtree(cleanup_dir, ignore_errors=True)
    inference_done_at_ms = now_ms()

    response_at_ms = now_ms()
    payload["timing"] = {
        "requestReceivedAtMs": request_received_at_ms,
        "audioDecodedAtMs": audio_decoded_at_ms,
        "inferenceStartAtMs": inference_start_at_ms,
        "inferenceDoneAtMs": inference_done_at_ms,
        "responseAtMs": response_at_ms,
        "inferenceLatencyMs": max(0, inference_done_at_ms - inference_start_at_ms),
        "totalRequestMs": max(0, response_at_ms - request_received_at_ms),
    }
    return payload


@app.get("/health")
def health() -> Dict[str, Any]:
    queued_requests = max(0, diarization_pending_requests - diarization_max_inflight)
    return {
        "status": "ok",
        "engine": "pyannote",
        "model": diarization_model_default,
        "maxInflight": diarization_max_inflight,
        "queueDepth": queued_requests,
        "queueMax": diarization_queue_max,
    }


@app.post("/diarize")
async def diarize(request: DiarizeRequest) -> Dict[str, Any]:
    request_received_at_ms = now_ms()

    try:
        audio_bytes = base64.b64decode(request.audio_base64)
        audio_decoded_at_ms = now_ms()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid audio_base64") from exc

    model_name = request.model or diarization_model_default
    label = os.path.basename(request.filename or "uploaded_audio")
    suffix = ("-" + label) if label else ""

    with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp.flush()
        return await diarize_from_audio_path(
            tmp.name,
            model_name,
            request_received_at_ms,
            audio_decoded_at_ms,
        )


@app.post("/diarize-file")
async def diarize_file(
    audio_file: UploadFile = File(...),
    model: Optional[str] = Form(None),
) -> Dict[str, Any]:
    request_received_at_ms = now_ms()
    model_name = model or diarization_model_default
    upload_name = os.path.basename(audio_file.filename or "uploaded_audio")

    source_path = getattr(audio_file.file, "name", None)
    if isinstance(source_path, str) and os.path.exists(source_path):
        audio_decoded_at_ms = now_ms()
        try:
            return await diarize_from_audio_path(
                source_path,
                model_name,
                request_received_at_ms,
                audio_decoded_at_ms,
            )
        finally:
            await audio_file.close()

    suffix = ("-" + upload_name) if upload_name else ""
    with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
        while True:
            chunk = await audio_file.read(1024 * 1024)
            if not chunk:
                break
            tmp.write(chunk)
        tmp.flush()
        await audio_file.close()
        audio_decoded_at_ms = now_ms()
        return await diarize_from_audio_path(
            tmp.name,
            model_name,
            request_received_at_ms,
            audio_decoded_at_ms,
        )
