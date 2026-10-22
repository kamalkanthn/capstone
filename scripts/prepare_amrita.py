"""Build a reproducible manifest for the folder-organized Amrita SLR archive.

The released archive contains class folders and video filenames but no signer
metadata. This script therefore offers an explicitly clip-stratified pilot split;
it never invents signer IDs. Use a separately reviewed signer-labeled manifest
with train.py --require-signer-disjoint for signer-independent evaluation.
"""

from __future__ import annotations

import argparse
import csv
import random
import re
from collections import Counter
from pathlib import Path


LABEL_ALIASES = {
    "goodmorning": "good morning",
    "thankyou": "thank you",
    "youareperfect": "you are perfect",
    "tommorow": "tomorrow",
    "umberlla": "umbrella",
}
VIDEO_SUFFIXES = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


def label_from_folder(name: str) -> str | None:
    match = re.match(r"^\s*\d+\s*[._-]\s*(.+?)\s*$", name)
    if not match:
        return None
    raw = match.group(1).strip()
    key = re.sub(r"[^a-z0-9]", "", raw.casefold())
    return LABEL_ALIASES.get(key, re.sub(r"\s+", " ", raw.replace("_", " ")).strip().casefold())


def split_clips(rows: list[dict[str, str]], seed: int) -> None:
    rng = random.Random(seed)
    by_label: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        by_label.setdefault(row["label"], []).append(row)
    for label, clips in by_label.items():
        if len(clips) < 3:
            raise SystemExit(f"Need at least 3 clips to create all splits; {label!r} has {len(clips)}")
        rng.shuffle(clips)
        test_count = max(1, round(len(clips) * 0.15))
        validation_count = max(1, round(len(clips) * 0.15))
        if test_count + validation_count >= len(clips):
            test_count = validation_count = 1
        for index, row in enumerate(clips):
            row["split"] = "test" if index < test_count else "validation" if index < test_count + validation_count else "train"
            row["signer_id"] = ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("data/raw/extracted"))
    parser.add_argument("--output", type=Path, default=Path("data/processed/manifest.csv"))
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rows: list[dict[str, str]] = []
    for path in sorted(args.root.rglob("*")):
        if path.is_file() and path.suffix.lower() in VIDEO_SUFFIXES:
            label = label_from_folder(path.parent.name)
            if label:
                rows.append({"video_path": path.relative_to(args.root).as_posix(), "label": label})
    if not rows:
        raise SystemExit(f"No class-folder video clips found under {args.root}")
    split_clips(rows, args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=("video_path", "label", "signer_id", "split"))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} clips, {len({row['label'] for row in rows})} labels to {args.output}")
    print("Split is stratified by clip, not signer: the source archive provides no reviewed signer metadata.")
    print(f"Clip counts: {dict(Counter(row['split'] for row in rows))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
