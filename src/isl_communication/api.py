"""Local inference and vocabulary-clip API for the SignBridge demo."""

from __future__ import annotations

import csv
import mimetypes
import os
import tempfile
import time
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from pathlib import Path

import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from isl_communication.recognition.model import MobileNetGRU
from isl_communication.vision.clip import decode_clip, preprocess_rgb_frame

ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = Path(os.environ.get("ISL_MODEL_PATH", ROOT / "models/isl_mobilenet_gru.pt"))
MANIFEST_PATH = Path(os.environ.get("ISL_MANIFEST", ROOT / "data/processed/manifest.csv"))
DATA_ROOT = Path(os.environ.get("ISL_DATA_ROOT", ROOT / "data/raw/extracted"))
MAX_UPLOAD = 200 * 1024 * 1024

app = FastAPI(title="SignBridge ISL Prototype", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:4173", "http://localhost:4173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_model: MobileNetGRU | None = None
_checkpoint: dict | None = None
_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

TRANSLATION_LANGUAGES = {
    "kn": {"name": "Kannada", "native_name": "ಕನ್ನಡ", "speech_tag": "kn-IN"},
    "hi": {"name": "Hindi", "native_name": "हिन्दी", "speech_tag": "hi-IN"},
    "ta": {"name": "Tamil", "native_name": "தமிழ்", "speech_tag": "ta-IN"},
    "te": {"name": "Telugu", "native_name": "తెలుగు", "speech_tag": "te-IN"},
    "ml": {"name": "Malayalam", "native_name": "മലയാളം", "speech_tag": "ml-IN"},
}


class TranslationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    target_language: str


def manifest_rows() -> list[dict[str, str]]:
    if not MANIFEST_PATH.exists():
        return []
    with MANIFEST_PATH.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def load_model() -> tuple[MobileNetGRU, dict]:
    global _model, _checkpoint
    if _model is None or _checkpoint is None:
        if not MODEL_PATH.is_file():
            raise HTTPException(status_code=503, detail="No trained ISL model is available. Run scripts/train.py first.")
        checkpoint = torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
        model = MobileNetGRU(len(checkpoint["classes"]), pretrained=False)
        model.load_state_dict(checkpoint["state_dict"])
        model.to(_device).eval()
        _model, _checkpoint = model, checkpoint
    return _model, _checkpoint


@app.get("/api/health")
def health() -> dict:
    rows = manifest_rows()
    return {
        "model_available": MODEL_PATH.is_file(),
        "sentence_model_available": False,
        "dataset_manifest_available": MANIFEST_PATH.is_file(),
        "vocabulary_size": len({row.get("label", "") for row in rows if row.get("label")}),
        "device": str(_device),
        "scope": "live sliding-window isolated-sign labels; not sentence-level translation",
        "translation_available": True,
        "translation_languages": TRANSLATION_LANGUAGES,
    }


@app.post("/api/translate")
def translate(request: TranslationRequest) -> dict:
    """Translate English text through MyMemory; source text leaves this computer."""
    text = " ".join(request.text.split())
    language = request.target_language
    if language not in TRANSLATION_LANGUAGES:
        raise HTTPException(status_code=422, detail="Choose Kannada, Hindi, Tamil, Telugu, or Malayalam.")
    if len(text.encode("utf-8")) > 500:
        raise HTTPException(status_code=413, detail="Translation text must be 500 UTF-8 bytes or fewer.")

    query = urlencode({"q": text, "langpair": f"en|{language}", "mt": "1"})
    req = Request(
        f"https://api.mymemory.translated.net/get?{query}",
        headers={"User-Agent": "SignBridge-Capstone/0.1"},
    )
    try:
        with urlopen(req, timeout=12) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Translation provider returned HTTP {error.code}.") from error
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=502, detail="Translation service is unreachable. Check internet access and try again.") from error

    if result.get("responseStatus") != 200:
        message = result.get("responseDetails") or "Translation provider could not translate this text."
        raise HTTPException(status_code=502, detail=message)
    translated = result.get("responseData", {}).get("translatedText", "").strip()
    if not translated:
        raise HTTPException(status_code=502, detail="Translation provider returned an empty result.")
    return {
        "source_text": text,
        "translated_text": translated,
        "source_language": "en",
        "target_language": language,
        "target_language_name": TRANSLATION_LANGUAGES[language]["name"],
        "speech_tag": TRANSLATION_LANGUAGES[language]["speech_tag"],
        "provider": "MyMemory machine translation",
        "quality_note": "Automatic translation; review before relying on it. Sign-label sequences are not grammatical sentence translation.",
    }


@app.get("/api/sign-example")
def sign_example(text: str) -> dict:
    phrase = " ".join(text.strip().casefold().split())
    if not phrase:
        raise HTTPException(status_code=400, detail="Enter one supported vocabulary word.")
    rows = manifest_rows()
    if not rows:
        raise HTTPException(status_code=503, detail="The ISL dataset manifest is not installed.")
    labels = {row["label"].strip().casefold(): row for row in rows if row.get("label")}
    row = labels.get(phrase)
    if row is None:
        if " " in phrase:
            raise HTTPException(status_code=422, detail="This prototype only looks up an exact dataset sign label. Sentence-to-ISL grammar is not implemented.")
        available = sorted(labels.keys())
        raise HTTPException(status_code=404, detail={"message": "No recorded sign clip for that dataset label.", "available_labels": available})
    path = (DATA_ROOT / row["video_path"]).resolve()
    try:
        path.relative_to(DATA_ROOT.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Manifest video path is outside the dataset root.")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="The recorded sign clip is missing from local data.")
    return {
        "label": row["label"],
        "video_url": f"/api/sign-asset?video_path={row['video_path']}",
        "kind": "recorded isolated vocabulary example",
        "translation": False,
        "attribution": "Sasidharan et al. (2025), Amrita SLR- Real Time ISL Dataset, Mendeley Data v1, CC BY 4.0, DOI 10.17632/dtg9s785v8.1",
        "source_url": "https://doi.org/10.17632/dtg9s785v8.1",
    }


@app.get("/api/sign-asset")
def sign_asset(video_path: str) -> FileResponse:
    path = (DATA_ROOT / video_path).resolve()
    try:
        path.relative_to(DATA_ROOT.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid asset path.")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Sign video asset not found.")
    return FileResponse(
        path,
        media_type=mimetypes.guess_type(path.name)[0] or "application/octet-stream",
        filename=path.name,
        content_disposition_type="inline",
    )


@app.post("/api/predict")
async def predict(video: UploadFile = File(...)) -> dict:
    suffix = Path(video.filename or "clip.mp4").suffix.lower()
    if suffix not in {".mp4", ".mov", ".webm", ".avi", ".mkv"}:
        raise HTTPException(status_code=415, detail="Upload an MP4, MOV, WebM, AVI, or MKV video.")
    fd, temp_name = tempfile.mkstemp(suffix=suffix, prefix="isl-clip-")
    os.close(fd)
    file_path = Path(temp_name)
    size = 0
    try:
        with file_path.open("wb") as output:
            while chunk := await video.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD:
                    raise HTTPException(status_code=413, detail="Maximum upload size is 200 MB.")
                output.write(chunk)
        model, checkpoint = load_model()
        started = time.perf_counter()
        clip = decode_clip(file_path, checkpoint.get("frames", 12), checkpoint.get("input_size", 160)).unsqueeze(0).to(_device)
        with torch.inference_mode():
            scores = model(clip).softmax(dim=1)[0]
        elapsed = (time.perf_counter() - started) * 1000
        confidence, index = scores.max(dim=0)
        score = float(confidence.cpu())
        threshold = float(checkpoint.get("threshold", 1.01))
        top_scores, top_indices = torch.topk(scores, k=min(3, len(checkpoint["classes"])))
        alternatives = [
            {"label": checkpoint["classes"][int(class_index)], "confidence": float(value.cpu())}
            for value, class_index in zip(top_scores, top_indices)
        ]
        if score < threshold:
            return {"accepted": False, "label": None, "alternatives": alternatives, "confidence": score, "threshold": threshold, "latency_ms": elapsed, "message": "Low confidence: please review the candidate labels or record the sign again."}
        return {"accepted": True, "label": checkpoint["classes"][int(index)], "alternatives": alternatives, "confidence": score, "threshold": threshold, "latency_ms": elapsed, "message": "Isolated vocabulary prediction. This is not continuous sentence translation."}
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=422, detail=f"Could not process this clip: {error}") from error
    finally:
        file_path.unlink(missing_ok=True)
        await video.close()


@app.post("/api/predict-frames")
async def predict_frames(frames: list[UploadFile] = File(...), mode: str = Form("single")) -> dict:
    """Classify one sliding window from the live camera without storing it."""
    try:
        if mode == "continuous":
            raise HTTPException(status_code=503, detail="No continuous sentence model is installed. This API currently supports isolated signs only.")
        if mode != "single":
            raise HTTPException(status_code=422, detail="Mode must be 'single' or 'continuous'.")
        if len(frames) < 4 or len(frames) > 24:
            raise HTTPException(status_code=422, detail="Send between 4 and 24 ordered camera frames.")
        model, checkpoint = load_model()
        size = int(checkpoint.get("input_size", 160))
        decoded: list[np.ndarray] = []
        total_bytes = 0
        for uploaded in frames:
            raw = await uploaded.read()
            total_bytes += len(raw)
            if len(raw) > 2 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="Each camera frame must be 2 MB or smaller.")
            if total_bytes > 12 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="The full camera window must be 12 MB or smaller.")
            image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
            if image is None:
                raise HTTPException(status_code=415, detail="A camera frame could not be decoded as an image.")
            decoded.append(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))

        target_frames = int(checkpoint.get("frames", 12))
        positions = np.linspace(0, len(decoded) - 1, num=target_frames, dtype=np.int64)
        clip = torch.stack([preprocess_rgb_frame(decoded[int(index)], size) for index in positions]).unsqueeze(0).to(_device)
        started = time.perf_counter()
        with torch.inference_mode():
            scores = model(clip).softmax(dim=1)[0]
        elapsed = (time.perf_counter() - started) * 1000
        confidence, index = scores.max(dim=0)
        score = float(confidence.cpu())
        threshold = float(checkpoint.get("threshold", 1.01))
        review_threshold = 0.15
        top_scores, top_indices = torch.topk(scores, k=min(3, len(checkpoint["classes"])))
        alternatives = [
            {"label": checkpoint["classes"][int(class_index)], "confidence": float(value.cpu())}
            for value, class_index in zip(top_scores, top_indices)
        ]
        accepted = score >= threshold
        return {
            "accepted": accepted,
            "label": checkpoint["classes"][int(index)] if accepted else None,
            "alternatives": alternatives,
            "confidence": score,
            "score_type": "uncalibrated_softmax_top_class_score",
            "threshold": threshold,
            "review_threshold": review_threshold,
            "reviewable": score >= review_threshold,
            "latency_ms": elapsed,
            "message": "Live isolated-sign window. Word order is shown as recognized; sentence-level ISL translation is not implemented.",
        }
    finally:
        for uploaded in frames:
            await uploaded.close()
