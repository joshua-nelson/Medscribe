import asyncio
import base64
import os
import shutil
import subprocess
import tempfile
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool


_ASR_MODEL_CACHE: Dict[str, Any] = {}


def parse_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


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


def _find_all_offsets(data: bytes, marker: bytes) -> List[int]:
    offsets: List[int] = []
    start = 0
    while True:
        idx = data.find(marker, start)
        if idx == -1:
            break
        offsets.append(idx)
        start = idx + 1
    return offsets


def prepare_transcription_audio_path(audio_path: str) -> tuple[str, Optional[str]]:
    if not audio_path.lower().endswith(".webm"):
        return audio_path, None

    try:
        with open(audio_path, "rb") as handle:
            data = handle.read()
    except Exception:
        return audio_path, None

    ebml_offsets = _find_all_offsets(data, b"\x1a\x45\xdf\xa3")
    if len(ebml_offsets) <= 1:
        return audio_path, None

    temp_dir = tempfile.mkdtemp(prefix="asr-webm-remux-")
    concat_list_path = os.path.join(temp_dir, "concat-list.txt")
    output_path = os.path.join(temp_dir, "combined.wav")

    try:
        with open(concat_list_path, "w", encoding="utf-8") as concat_list_file:
            for i, start in enumerate(ebml_offsets):
                end = ebml_offsets[i + 1] if i + 1 < len(ebml_offsets) else len(data)
                segment_path = os.path.join(temp_dir, f"segment-{i:05d}.webm")
                with open(segment_path, "wb") as segment_file:
                    segment_file.write(data[start:end])
                escaped_path = segment_path.replace("'", "'\\''")
                concat_list_file.write(f"file '{escaped_path}'\n")

        subprocess.run(
            [
                "ffmpeg",
                "-nostdin",
                "-hide_banner",
                "-loglevel",
                "error",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                concat_list_path,
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
    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        return audio_path, None

    return output_path, temp_dir


def get_openai_whisper_model(model_name: str):
    cache_key = "openai_whisper:%s" % model_name
    if cache_key in _ASR_MODEL_CACHE:
        return _ASR_MODEL_CACHE[cache_key]

    import whisper  # type: ignore

    model = whisper.load_model(model_name)
    _ASR_MODEL_CACHE[cache_key] = model
    return model


def get_faster_whisper_model(model_name: str, compute_type: str):
    cache_key = "faster_whisper:%s:%s" % (model_name, compute_type)
    if cache_key in _ASR_MODEL_CACHE:
        return _ASR_MODEL_CACHE[cache_key]

    from faster_whisper import WhisperModel  # type: ignore

    model = WhisperModel(model_name, device="cpu", compute_type=compute_type)
    _ASR_MODEL_CACHE[cache_key] = model
    return model


def get_parakeet_model(model_name: str):
    cache_key = "parakeet_onnx:%s" % model_name
    if cache_key in _ASR_MODEL_CACHE:
        return _ASR_MODEL_CACHE[cache_key]

    try:
        import sherpa_onnx  # type: ignore
    except ImportError:
        # Fallback to NeMo if sherpa-onnx not available
        import nemo.collections.asr as nemo_asr  # type: ignore
        model = nemo_asr.models.ASRModel.from_pretrained(model_name=model_name)
        _ASR_MODEL_CACHE[cache_key] = model
        return model

    # Use sherpa-onnx for ONNX model (much faster on CPU)
    # Model: csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8
    from huggingface_hub import hf_hub_download
    
    # Download ONNX model files
    encoder = hf_hub_download(
        repo_id="csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8",
        filename="encoder.int8.onnx"
    )
    decoder = hf_hub_download(
        repo_id="csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8",
        filename="decoder.int8.onnx"
    )
    joiner = hf_hub_download(
        repo_id="csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8",
        filename="joiner.int8.onnx"
    )
    tokens = hf_hub_download(
        repo_id="csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8",
        filename="tokens.txt"
    )

    # Create recognizer
    recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=encoder,
        decoder=decoder,
        joiner=joiner,
        tokens=tokens,
        num_threads=2,
        sample_rate=16000,
        feature_dim=80,
        decoding_method="greedy_search",
    )
    
    _ASR_MODEL_CACHE[cache_key] = recognizer
    return recognizer


def mock_transcription(label: str) -> Dict[str, Any]:
    segments = [
        {"start": 0.0, "end": 2.8, "text": "Mock transcript for %s." % label},
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


def openai_whisper_transcription(audio_path: str, model_name: str) -> Dict[str, Any]:
    try:
        model = get_openai_whisper_model(model_name)
    except Exception:
        return mock_transcription(audio_path)

    result = model.transcribe(audio_path)
    segments: List[Dict[str, Any]] = []
    for segment in result.get("segments", []):
        text = (segment.get("text") or "").strip()
        if not text:
            continue
        segments.append(
            {
                "start": float(segment.get("start", 0.0)),
                "end": float(segment.get("end", 0.0)),
                "text": text,
            }
        )

    full_text = (result.get("text") or "").strip()
    return {
        "full_text": full_text,
        "segments": segments,
        "language": result.get("language", "en"),
        "model": model_name,
        "engine": "openai_whisper",
        "created_at": datetime.utcnow().isoformat() + "Z",
    }


def faster_whisper_transcription(audio_path: str, model_name: str, compute_type: str) -> Dict[str, Any]:
    try:
        model = get_faster_whisper_model(model_name, compute_type)
    except Exception:
        return openai_whisper_transcription(audio_path, model_name)

    try:
        segments_iter, info = model.transcribe(
            audio_path,
            beam_size=1,
            condition_on_previous_text=False,
            vad_filter=False,
        )
    except Exception:
        return openai_whisper_transcription(audio_path, model_name)

    segments: List[Dict[str, Any]] = []
    text_parts: List[str] = []
    for segment in segments_iter:
        text = (segment.text or "").strip()
        if not text:
            continue
        segments.append(
            {
                "start": float(segment.start),
                "end": float(segment.end),
                "text": text,
            }
        )
        text_parts.append(text)

    full_text = " ".join(text_parts).strip()
    language = getattr(info, "language", "en") if info is not None else "en"
    return {
        "full_text": full_text,
        "segments": segments,
        "language": language,
        "model": model_name,
        "engine": "faster_whisper",
        "created_at": datetime.utcnow().isoformat() + "Z",
    }


def parakeet_transcription(audio_path: str, model_name: str = "nvidia/parakeet-tdt-0.6b-v3") -> Dict[str, Any]:
    try:
        recognizer = get_parakeet_model(model_name)
    except Exception:
        return faster_whisper_transcription(audio_path, "base.en", "int8")

    try:
        # Check if using sherpa-onnx or NeMo
        is_sherpa = hasattr(recognizer, 'create_stream')
        
        if is_sherpa:
            # Sherpa-ONNX path (ONNX model - faster on CPU)
            import sherpa_onnx  # type: ignore
            import soundfile as sf
            
            # Read audio file
            audio, sample_rate = sf.read(audio_path, dtype='float32')
            
            # Resample to 16kHz if needed
            if sample_rate != 16000:
                import scipy.signal
                audio = scipy.signal.resample_poly(audio, 16000, sample_rate)
                sample_rate = 16000
            
            # Create stream and decode
            stream = recognizer.create_stream()
            stream.accept_waveform(sample_rate, audio)
            recognizer.decode_stream(stream)
            result = stream.result
            
            full_text = result.text.strip()
            
            # Sherpa-ONNX provides word-level timestamps in tokens
            segments: List[Dict[str, Any]] = []
            if hasattr(result, 'tokens') and result.tokens:
                # Group words into segments (approximate)
                words = full_text.split()
                duration_per_word = len(audio) / sample_rate / max(len(words), 1)
                
                for i, word in enumerate(words):
                    start = i * duration_per_word
                    end = (i + 1) * duration_per_word
                    segments.append({
                        "start": round(start, 2),
                        "end": round(end, 2),
                        "text": word
                    })
            
            if not segments and full_text:
                segments.append({"start": 0.0, "end": len(audio) / sample_rate, "text": full_text})
                
            return {
                "full_text": full_text,
                "segments": segments,
                "language": "en",
                "model": "parakeet-tdt-0.6b-v3-int8-onnx",
                "engine": "parakeet_onnx",
                "created_at": datetime.utcnow().isoformat() + "Z",
            }
        else:
            # NeMo path (PyTorch model - slower on CPU but kept for GPU compatibility)
            output = recognizer.transcribe([audio_path], timestamps=True, batch_size=1)
            
            if not output or len(output) == 0:
                return faster_whisper_transcription(audio_path, "base.en", "int8")

            result = output[0]
            full_text = result.text if hasattr(result, "text") else ""

            segments: List[Dict[str, Any]] = []
            if hasattr(result, "timestamp") and result.timestamp:
                word_timestamps = result.timestamp.get("word", [])
                for word_data in word_timestamps:
                    text = word_data.get("word", "").strip()
                    if not text:
                        continue
                    segments.append(
                        {
                            "start": float(word_data.get("start", 0.0)),
                            "end": float(word_data.get("end", 0.0)),
                            "text": text,
                        }
                    )

            if not segments and full_text:
                segments.append({"start": 0.0, "end": 0.0, "text": full_text})

            return {
                "full_text": full_text,
                "segments": segments,
                "language": "en",
                "model": model_name,
                "engine": "parakeet_nemo",
                "created_at": datetime.utcnow().isoformat() + "Z",
            }
    except Exception:
        return faster_whisper_transcription(audio_path, "base.en", "int8")


class TranscribeRequest(BaseModel):
    audio_base64: str
    filename: Optional[str] = None
    model: Optional[str] = None


app = FastAPI()

asr_engine = os.getenv("ASR_ENGINE", "openai_whisper").strip().lower() or "openai_whisper"
if asr_engine not in {"openai_whisper", "faster_whisper", "parakeet"}:
    asr_engine = "openai_whisper"

asr_compute_type = os.getenv("ASR_COMPUTE_TYPE", "int8").strip() or "int8"
asr_parakeet_model = os.getenv("PARAKEET_MODEL", "nvidia/parakeet-tdt-0.6b-v3").strip() or "nvidia/parakeet-tdt-0.6b-v3"
asr_enable_base64_fallback = parse_bool_env("ASR_ENABLE_BASE64_FALLBACK", True)
asr_max_inflight = parse_positive_int_env("ASR_MAX_INFLIGHT", 2)
asr_queue_max = parse_non_negative_int_env("ASR_QUEUE_MAX", 4)
asr_queue_timeout_ms = parse_positive_int_env("ASR_QUEUE_TIMEOUT_MS", 2500)

asr_semaphore = asyncio.Semaphore(asr_max_inflight)
asr_pending_requests = 0
asr_pending_lock = asyncio.Lock()


def transcribe_with_engine(audio_path: str, model_name: str) -> Dict[str, Any]:
    if asr_engine == "faster_whisper":
        return faster_whisper_transcription(audio_path, model_name, asr_compute_type)
    elif asr_engine == "parakeet":
        parakeet_model = asr_parakeet_model if model_name in {"small", "base", "base.en"} else model_name
        return parakeet_transcription(audio_path, parakeet_model)
    return openai_whisper_transcription(audio_path, model_name)


async def run_asr_job(job: Callable[[], Dict[str, Any]]) -> Dict[str, Any]:
    global asr_pending_requests

    async with asr_pending_lock:
        queued_requests = max(0, asr_pending_requests - asr_max_inflight)
        if queued_requests >= asr_queue_max:
            raise HTTPException(status_code=429, detail="ASR queue overloaded")
        asr_pending_requests += 1

    acquired = False
    try:
        try:
            await asyncio.wait_for(asr_semaphore.acquire(), timeout=asr_queue_timeout_ms / 1000)
            acquired = True
        except TimeoutError as exc:
            raise HTTPException(status_code=429, detail="ASR queue timeout") from exc

        return await run_in_threadpool(job)
    finally:
        if acquired:
            asr_semaphore.release()
        async with asr_pending_lock:
            asr_pending_requests = max(0, asr_pending_requests - 1)


async def transcribe_from_audio_path(
    audio_path: str,
    model_name: str,
    request_received_at_ms: int,
    audio_decoded_at_ms: int,
) -> Dict[str, Any]:
    inference_start_at_ms = now_ms()
    prepared_audio_path, cleanup_dir = prepare_transcription_audio_path(audio_path)
    try:
        payload = await run_asr_job(lambda: transcribe_with_engine(prepared_audio_path, model_name))
    except RuntimeError as exc:
        if "Failed to load audio" in str(exc):
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        raise
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
    queued_requests = max(0, asr_pending_requests - asr_max_inflight)
    return {
        "status": "ok",
        "engine": asr_engine,
        "computeType": asr_compute_type,
        "maxInflight": asr_max_inflight,
        "queueDepth": queued_requests,
        "queueMax": asr_queue_max,
    }


@app.post("/transcribe")
async def transcribe(request: TranscribeRequest) -> Dict[str, Any]:
    if not asr_enable_base64_fallback:
        raise HTTPException(status_code=404, detail="Legacy /transcribe endpoint is disabled")

    request_received_at_ms = now_ms()

    try:
        audio_bytes = base64.b64decode(request.audio_base64)
        audio_decoded_at_ms = now_ms()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid audio_base64") from exc

    model_name = request.model or "small"
    label = os.path.basename(request.filename or "uploaded_audio")

    with tempfile.NamedTemporaryFile(suffix="-%s" % label) as tmp:
        tmp.write(audio_bytes)
        tmp.flush()
        return await transcribe_from_audio_path(
            tmp.name,
            model_name,
            request_received_at_ms,
            audio_decoded_at_ms,
        )


@app.post("/transcribe-file")
async def transcribe_file(
    audio_file: UploadFile = File(...),
    model: Optional[str] = Form(None),
) -> Dict[str, Any]:
    request_received_at_ms = now_ms()
    model_name = model or "small"
    upload_name = os.path.basename(audio_file.filename or "uploaded_audio")

    source_path = getattr(audio_file.file, "name", None)
    if isinstance(source_path, str) and os.path.exists(source_path):
        audio_decoded_at_ms = now_ms()
        try:
            return await transcribe_from_audio_path(
                source_path,
                model_name,
                request_received_at_ms,
                audio_decoded_at_ms,
            )
        finally:
            await audio_file.close()

    suffix = ("-%s" % upload_name) if upload_name else ""
    with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
        while True:
            chunk = await audio_file.read(1024 * 1024)
            if not chunk:
                break
            tmp.write(chunk)
        tmp.flush()
        await audio_file.close()
        audio_decoded_at_ms = now_ms()
        return await transcribe_from_audio_path(
            tmp.name,
            model_name,
            request_received_at_ms,
            audio_decoded_at_ms,
        )
