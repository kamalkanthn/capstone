"""Local inference and vocabulary-clip API for the SignBridge demo."""

from __future__ import annotations

import csv
import mimetypes
import os
import tempfile
import time
from pathlib import Path

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from isl_communication.recognition.model import MobileNetGRU
from isl_communication.vision.clip import decode_clip

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
        "dataset_manifest_available": MANIFEST_PATH.is_file(),
        "vocabulary_size": len({row.get("label", "") for row in rows if row.get("label")}),
        "device": str(_device),
        "scope": "isolated sign classification; not continuous sentence translation",
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
        if score < threshold:
            return {"accepted": False, "label": None, "confidence": score, "threshold": threshold, "latency_ms": elapsed, "message": "Low confidence: please review or record the sign again."}
        return {"accepted": True, "label": checkpoint["classes"][int(index)], "confidence": score, "threshold": threshold, "latency_ms": elapsed, "message": "Isolated vocabulary prediction. This is not continuous sentence translation."}
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=422, detail=f"Could not process this clip: {error}") from error
    finally:
        file_path.unlink(missing_ok=True)
        await video.close()
