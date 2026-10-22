"""Validate a simple video manifest without loading or copying media."""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter, defaultdict
from pathlib import Path

REQUIRED = {"video_path", "label", "split"}
ALLOWED_SPLITS = {"train", "validation", "test"}


def validate(root: Path, manifest: Path) -> list[str]:
    errors: list[str] = []
    labels: Counter[str] = Counter()
    split_counts: Counter[str] = Counter()
    signer_splits: dict[str, set[str]] = defaultdict(set)
    try:
        handle = manifest.open("r", encoding="utf-8-sig", newline="")
    except OSError as exc:
        return [f"Cannot read manifest: {exc}"]
    with handle:
        reader = csv.DictReader(handle)
        fields = set(reader.fieldnames or [])
        missing = REQUIRED - fields
        if missing:
            return [f"Missing required columns: {', '.join(sorted(missing))}"]
        for line, row in enumerate(reader, start=2):
            rel = (row.get("video_path") or "").strip()
            label = (row.get("label") or "").strip()
            split = (row.get("split") or "").strip().lower()
            signer = (row.get("signer_id") or "").strip()
            if not rel or not label:
                errors.append(f"Line {line}: video_path and label must be non-empty")
                continue
            path = (root / rel).resolve()
            try:
                path.relative_to(root.resolve())
            except ValueError:
                errors.append(f"Line {line}: path escapes dataset root: {rel}")
                continue
            if not path.is_file():
                errors.append(f"Line {line}: video file not found: {rel}")
            if split not in ALLOWED_SPLITS:
                errors.append(f"Line {line}: unsupported split {split!r}")
            labels[label] += 1
            split_counts[split] += 1
            if signer and split in ALLOWED_SPLITS:
                signer_splits[signer].add(split)
    for signer, splits in signer_splits.items():
        if len(splits) > 1:
            errors.append(f"Signer {signer!r} appears in multiple splits: {', '.join(sorted(splits))}")
    if labels:
        print(f"Clips: {sum(labels.values())}; labels: {len(labels)}")
        print("Split counts: " + ", ".join(f"{k}={v}" for k, v in sorted(split_counts.items())))
        print("Class counts: " + ", ".join(f"{k}={v}" for k, v in sorted(labels.items())))
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset_root", type=Path)
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()
    errors = validate(args.dataset_root, args.manifest)
    if errors:
        print("Dataset manifest validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("Manifest validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
