"""Ordered, fixed-length frame sampling for isolated-sign clips."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image
from torchvision.transforms import functional as TF

MEAN = torch.tensor([0.485, 0.456, 0.406])[:, None, None]
STD = torch.tensor([0.229, 0.224, 0.225])[:, None, None]


def decode_clip(path: str | Path, frames: int = 12, size: int = 160) -> torch.Tensor:
    """Return TCHW RGB float frames, uniformly sampled in temporal order."""
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise ValueError(f"Cannot open video: {path}")
    count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    if count < 1:
        capture.release()
        raise ValueError(f"Video has no readable frames: {path}")
    positions = np.linspace(0, max(0, count - 1), num=min(frames, count), dtype=np.int64)
    positions = np.unique(positions)
    samples: list[torch.Tensor] = []
    target = 0
    index = 0
    while target < len(positions):
        ok, frame = capture.read()
        if not ok:
            break
        if index == positions[target]:
            h, w = frame.shape[:2]
            scale = size / max(h, w)
            width, height = max(1, round(w * scale)), max(1, round(h * scale))
            frame = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)
            canvas = np.zeros((size, size, 3), dtype=np.uint8)
            x, y = (size - width) // 2, (size - height) // 2
            canvas[y:y + height, x:x + width] = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image = Image.fromarray(canvas)
            tensor = TF.to_tensor(image)
            samples.append((tensor - MEAN) / STD)
            target += 1
            if target == len(positions):
                break
        index += 1
    capture.release()
    if not samples:
        raise ValueError(f"Could not decode frames from: {path}")
    while len(samples) < frames:
        samples.append(samples[-1].clone())
    return torch.stack(samples[:frames])
