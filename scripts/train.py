"""Train an isolated dynamic-sign MobileNetV3 + BiGRU classifier.

Input manifest columns: video_path,label,signer_id,split. Keep signers disjoint
across splits. This is an isolated-sign experiment, not sentence translation.
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

from isl_communication.recognition.model import MobileNetGRU
from isl_communication.vision.clip import decode_clip


class VideoDataset(Dataset):
    def __init__(self, rows: list[dict[str, str]], root: Path, labels: dict[str, int], frames: int):
        self.rows, self.root, self.labels, self.frames = rows, root, labels, frames

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int):
        row = self.rows[index]
        clip = decode_clip(self.root / row["video_path"], self.frames)
        if random.random() < 0.5:
            clip = clip * random.uniform(0.85, 1.15)
        return clip, self.labels[row["label"]]


def scores(model, loader, device):
    model.eval()
    ys, preds, probs = [], [], []
    started = time.perf_counter()
    with torch.inference_mode():
        for clips, labels in loader:
            logits = model(clips.to(device))
            batch_probs = logits.softmax(dim=1).cpu().numpy()
            probs.extend(batch_probs)
            preds.extend(batch_probs.argmax(axis=1))
            ys.extend(labels.numpy())
    elapsed = time.perf_counter() - started
    return np.asarray(ys), np.asarray(preds), np.asarray(probs), elapsed


def classification_metrics(y, pred, n_classes):
    matrix = np.zeros((n_classes, n_classes), dtype=np.int64)
    for actual, guess in zip(y, pred):
        matrix[int(actual), int(guess)] += 1
    recall = np.divide(matrix.diagonal(), matrix.sum(axis=1), out=np.zeros(n_classes, dtype=float), where=matrix.sum(axis=1) != 0)
    precision = np.divide(matrix.diagonal(), matrix.sum(axis=0), out=np.zeros(n_classes, dtype=float), where=matrix.sum(axis=0) != 0)
    f1 = np.divide(2 * precision * recall, precision + recall, out=np.zeros(n_classes, dtype=float), where=(precision + recall) != 0)
    return {"accuracy": float(np.mean(y == pred)), "macro_f1": float(f1.mean()), "per_class_recall": recall.tolist(), "confusion_matrix": matrix}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path("data/processed/manifest.csv"))
    parser.add_argument("--data-root", type=Path, default=Path("data/raw/extracted"))
    parser.add_argument("--output", type=Path, default=Path("models/isl_mobilenet_gru.pt"))
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--frames", type=int, default=12)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--require-signer-disjoint", action="store_true", help="Fail unless every clip has a reviewed signer ID and signers are split-disjoint")
    args = parser.parse_args()
    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)
    if torch.cuda.is_available(): torch.cuda.manual_seed_all(args.seed)
    with args.manifest.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        raise SystemExit("Manifest is empty")
    for row in rows:
        row["split"] = row.get("split", "").strip().lower()
        row["signer_id"] = row.get("signer_id", "").strip()
    if args.require_signer_disjoint and any(not row["signer_id"] for row in rows):
        raise SystemExit("Signer-disjoint evaluation requested, but the manifest has clips without reviewed signer IDs")
    splits = {key: [row for row in rows if row["split"] == key] for key in ("train", "validation", "test")}
    if any(not split for split in splits.values()):
        raise SystemExit("Manifest needs non-empty train, validation, and test splits")
    signer_splits: dict[str, set[str]] = {}
    for row in rows:
        signer = row["signer_id"]
        if signer:
            signer_splits.setdefault(signer, set()).add(row["split"])
    leaked = [signer for signer, values in signer_splits.items() if len(values) > 1]
    if leaked:
        raise SystemExit(f"Signer leakage across splits: {', '.join(leaked)}")
    signer_disjoint = bool(signer_splits) and all(row["signer_id"] for row in rows)
    classes = sorted({row["label"] for row in rows})
    label_to_id = {label: index for index, label in enumerate(classes)}
    datasets = {key: VideoDataset(value, args.data_root, label_to_id, args.frames) for key, value in splits.items()}
    loaders = {key: DataLoader(value, batch_size=args.batch_size, shuffle=key == "train", num_workers=0) for key, value in datasets.items()}
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}; classes={len(classes)}; split_counts={ {k:len(v) for k,v in splits.items()} }; signers={len(signer_splits)}")
    model = MobileNetGRU(len(classes), pretrained=True).to(device)
    for layer in list(model.features.children())[:-3]:
        for parameter in layer.parameters(): parameter.requires_grad = False
    optimizer = torch.optim.AdamW((p for p in model.parameters() if p.requires_grad), lr=2e-4, weight_decay=1e-3)
    counts = Counter(row["label"] for row in splits["train"])
    weights = torch.tensor([len(splits["train"]) / (len(classes) * counts[label]) for label in classes], dtype=torch.float32, device=device)
    criterion = nn.CrossEntropyLoss(weight=weights, label_smoothing=0.05)
    best_f1, best_state, patience = -1.0, None, 0
    started = time.perf_counter()
    for epoch in range(1, args.epochs + 1):
        model.train(); loss_sum = 0.0
        for clips, labels in loaders["train"]:
            clips, labels = clips.to(device), labels.to(device)
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(clips), labels)
            loss.backward(); nn.utils.clip_grad_norm_(model.parameters(), 2.0); optimizer.step()
            loss_sum += float(loss.detach())
        y, pred, _, _ = scores(model, loaders["validation"], device)
        metrics = classification_metrics(y, pred, len(classes))
        print(f"epoch={epoch:02d} loss={loss_sum/max(1,len(loaders['train'])):.4f} val_accuracy={metrics['accuracy']:.4f} val_macro_f1={metrics['macro_f1']:.4f}", flush=True)
        if metrics["macro_f1"] > best_f1:
            best_f1, best_state, patience = metrics["macro_f1"], {k:v.detach().cpu().clone() for k,v in model.state_dict().items()}, 0
        else:
            patience += 1
            if patience >= 5: break
    if best_state is None:
        raise SystemExit("Training did not produce a model")
    model.load_state_dict(best_state); model.to(device)
    y, pred, probs, infer_time = scores(model, loaders["test"], device)
    test = classification_metrics(y, pred, len(classes))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "classes": classes, "frames": args.frames, "input_size": 160, "threshold": 0.45, "validation_macro_f1": best_f1}, args.output)
    report = {"dataset_manifest": str(args.manifest), "split_protocol": "signer-disjoint" if signer_disjoint else "random clip split; signer identity unavailable; results may be optimistic", "split_counts": {k: len(v) for k,v in splits.items()}, "signer_count": len(signer_splits), "seed": args.seed, "epochs_requested": args.epochs, "training_seconds": time.perf_counter()-started, "device": str(device), "torch": torch.__version__, "test_accuracy": test["accuracy"], "test_macro_f1": test["macro_f1"], "test_per_class_recall": dict(zip(classes,test["per_class_recall"])), "test_confusion_matrix": test["confusion_matrix"].tolist(), "mean_model_batch_latency_ms": infer_time*1000/max(1,len(loaders['test'])), "mean_clip_latency_ms": infer_time*1000/max(1,len(datasets['test'])), "model_artifact": str(args.output), "unknown_rejection_threshold": 0.45, "threshold_note": "Provisional threshold; no out-of-vocabulary sign examples exist to evaluate unknown rejection."}
    report_path = args.output.with_suffix(".metrics.json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"test_accuracy": test["accuracy"], "test_macro_f1": test["macro_f1"], "mean_clip_latency_ms": report["mean_clip_latency_ms"], "artifact": str(args.output), "metrics": str(report_path)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
