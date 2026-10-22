"""Sample ordered frames from a video at a fixed target rate.

Requires OpenCV (`pip install opencv-python`). Writes a NumPy array and a JSON
sidecar containing sampled timestamps and source metadata. This utility does
not perform augmentation, splitting, or landmark extraction.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def sample_video(source: Path, output: Path, fps: float, size: int) -> None:
    try:
        import cv2
        import numpy as np
    except ImportError as exc:
        raise SystemExit("Install dependencies with: pip install opencv-python numpy") from exc
    if fps <= 0 or size <= 0:
        raise ValueError("fps and size must be positive")
    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        raise ValueError(f"Could not open video: {source}")
    source_fps = float(capture.get(cv2.CAP_PROP_FPS))
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    if not source_fps or source_fps <= 0:
        capture.release()
        raise ValueError("Source FPS is unavailable; cannot calculate timestamps reliably")
    interval_ms = 1000.0 / fps
    next_sample_ms = 0.0
    frames: list[object] = []
    timestamps_ms: list[float] = []
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        timestamp_ms = float(capture.get(cv2.CAP_PROP_POS_MSEC))
        if timestamp_ms + 1e-3 >= next_sample_ms:
            h, w = frame.shape[:2]
            scale = size / max(h, w)
            resized = cv2.resize(frame, (max(1, round(w * scale)), max(1, round(h * scale))))
            canvas = np.zeros((size, size, 3), dtype=np.uint8)
            y = (size - resized.shape[0]) // 2
            x = (size - resized.shape[1]) // 2
            canvas[y:y + resized.shape[0], x:x + resized.shape[1]] = resized
            frames.append(cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB))
            timestamps_ms.append(timestamp_ms)
            while next_sample_ms <= timestamp_ms + 1e-3:
                next_sample_ms += interval_ms
    capture.release()
    if not frames:
        raise ValueError("No frames were sampled")
    output.parent.mkdir(parents=True, exist_ok=True)
    np.save(output, np.stack(frames))
    sidecar = output.with_suffix(".json")
    sidecar.write_text(json.dumps({
        "source": str(source), "source_fps": source_fps, "source_frame_count": total,
        "sample_fps": fps, "frame_size": [size, size], "color_order": "RGB",
        "timestamps_ms": timestamps_ms,
    }, indent=2), encoding="utf-8")
    print(f"Wrote {len(frames)} ordered frames to {output} and {sidecar}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("output", type=Path, help="Output .npy path")
    parser.add_argument("--fps", type=float, default=8.0, help="Target sampling rate (default: 8)")
    parser.add_argument("--size", type=int, default=224, help="Square letterbox size (default: 224)")
    args = parser.parse_args()
    sample_video(args.video, args.output, args.fps, args.size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
