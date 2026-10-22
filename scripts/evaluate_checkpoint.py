"""Evaluate a saved checkpoint on an unaugmented validation or test split."""

from __future__ import annotations

import argparse
import csv
import json
import time
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from isl_communication.recognition.model import MobileNetGRU
from train import VideoDataset, classification_metrics, scores


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path("data/processed/manifest.csv"))
    parser.add_argument("--data-root", type=Path, default=Path("data/raw/extracted"))
    parser.add_argument("--checkpoint", type=Path, default=Path("models/isl_mobilenet_gru.pt"))
    parser.add_argument("--split", choices=("validation", "test"), default="test")
    parser.add_argument("--output", type=Path, default=Path("models/isl_mobilenet_gru.clean_test.metrics.json"))
    parser.add_argument("--batch-size", type=int, default=4)
    args = parser.parse_args()

    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=True)
    with args.manifest.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))
    classes = checkpoint["classes"]
    label_to_id = {label: index for index, label in enumerate(classes)}
    selected = [row for row in rows if row.get("split", "").strip().lower() == args.split]
    if not selected:
        raise SystemExit(f"No {args.split} clips found in {args.manifest}")

    dataset = VideoDataset(selected, args.data_root, label_to_id, checkpoint.get("frames", 12), augment=False)
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=False, num_workers=0)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = MobileNetGRU(len(classes), pretrained=False)
    model.load_state_dict(checkpoint["state_dict"])
    model.to(device).eval()
    y, pred, _, elapsed = scores(model, loader, device)
    metrics = classification_metrics(y, pred, len(classes))
    report = {
        "evaluation_split": args.split,
        "split_protocol": "random clip split; signer metadata unavailable; results may be optimistic",
        "clips": len(selected),
        "labels": len(classes),
        "augmentation": False,
        "accuracy": metrics["accuracy"],
        "macro_f1": metrics["macro_f1"],
        "per_class_recall": dict(zip(classes, metrics["per_class_recall"])),
        "confusion_matrix": metrics["confusion_matrix"].tolist(),
        "mean_end_to_end_batch_latency_ms": elapsed * 1000 / max(1, len(loader)),
        "mean_end_to_end_clip_latency_ms": elapsed * 1000 / max(1, len(dataset)),
        "latency_includes_video_decode": True,
        "device": str(device),
        "torch": torch.__version__,
        "checkpoint": str(args.checkpoint),
        "checkpoint_validation_augmentation": checkpoint.get("validation_augmentation", "not recorded"),
        "evaluated_at_unix": time.time(),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("evaluation_split", "clips", "labels", "accuracy", "macro_f1", "mean_end_to_end_clip_latency_ms", "device", "output") if key in report}, indent=2))
    print(f"Metrics written to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
