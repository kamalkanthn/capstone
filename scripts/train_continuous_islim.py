"""Prepare and train the separate ISLiM continuous ISL-to-English model.

Uses GloSL ISL pose annotations and ISLiM's 94-point temporal encoder + T5 decoder.
The small deterministic subset is intended as a reproducible local training run;
increase --train-limit/--eval-limit and --epochs for a longer experiment.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader
from huggingface_hub import hf_hub_download

ROOT = Path(__file__).resolve().parents[1]
ISLIM_ROOT = ROOT / "third_party" / "ISLiM-source"
sys.path.insert(0, str(ISLIM_ROOT))
from src.islim.model import ISLiMModel
from src.data.preprocessing import posestitch_preprocess
from src.metrics import compute_bleu, compute_rouge_l, compute_wer
from src.losses import entropy_regularization
from glosl.keypoints import read_pose, to_layout

ANNOTATIONS = ROOT / "data" / "raw" / "glosl" / "annotations.csv"
POSE_DIR = ROOT / "data" / "processed" / "glosl_isl_94"
OUT_DIR = ROOT / "models" / "continuous_islim"
REPO = "pedroodb/glosl-isl"
FACE = [61,146,91,181,84,17,314,405,321,375,291,409,270,95,88,178,87,14,78,308,
        33,133,160,158,153,144,145,246,362,263,387,385,380,373,374,249,
        107,66,105,63,70,336,296,334,293,300]
LAYOUT = [11,12,13,14,23,24] + list(range(501,522)) + list(range(522,543)) + [33+i for i in FACE]


def prepare(limit: int, eval_limit: int, seed: int) -> dict[str, Path]:
    if not ANNOTATIONS.exists():
        raise FileNotFoundError(f"Missing {ANNOTATIONS}; download the GloSL ISL annotations first.")
    rows = pd.read_csv(ANNOTATIONS, keep_default_na=False)
    rng = np.random.default_rng(seed)
    selected = {}
    for split, n in (("train", limit), ("dev", eval_limit), ("test", eval_limit)):
        part = rows[rows.split == split]
        part = part.iloc[rng.permutation(len(part))[:min(n, len(part))]].copy()
        selected[split] = part.reset_index(drop=True)
    POSE_DIR.mkdir(parents=True, exist_ok=True)
    manifests = {}
    for split, part in selected.items():
        def process(row):
            target = POSE_DIR / split / f"{row.id}.npy"
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                pose_path = hf_hub_download(REPO, row.pose_file, repo_type="dataset")
                xy, conf, width, height, _ = read_pose(pose_path)
                kp = to_layout(xy, conf, width, height, LAYOUT)  # [T,94,3] = x,y,confidence
                # ISLiM expects x,y,z,visibility. GloSL stores 2-D landmarks plus confidence.
                kp4 = np.zeros((len(kp), 94, 4), dtype=np.float32)
                kp4[:, :, :2] = kp[:, :, :2]
                kp4[:, :, 3] = kp[:, :, 2]
                np.save(target, kp4.astype(np.float16))
            return {"path": str(target), "text": posestitch_preprocess(str(row.text)), "id": str(row.id)}
        records = [None] * len(part)
        with ThreadPoolExecutor(max_workers=12) as pool:
            futures = {pool.submit(process, row): i for i, (_, row) in enumerate(part.iterrows())}
            for done, future in enumerate(as_completed(futures), 1):
                records[futures[future]] = future.result()
                if done % 200 == 0: print(f"Downloading/preparing {split}: {done}/{len(part)}", flush=True)
        manifest = POSE_DIR / f"{split}.jsonl"
        manifest.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in records), encoding="utf-8")
        manifests[split] = manifest
        print(f"Prepared {split}: {len(records)} clips", flush=True)
    (POSE_DIR / "data_card.json").write_text(json.dumps({
        "source": REPO, "license": "CC BY-NC 4.0", "seed": seed,
        "layout": "ISLiM 94 points; GloSL xy+confidence mapped to x,y,0,confidence",
        "counts": {k: len(v) for k, v in selected.items()},
        "official_split_policy": "GloSL v0.2 grouped_topic, source-video-disjoint",
    }, indent=2), encoding="utf-8")
    return manifests


class PoseTextDataset(Dataset):
    def __init__(self, manifest: Path, max_frames=128):
        self.items = [json.loads(x) for x in manifest.read_text(encoding="utf-8").splitlines() if x]
        self.max_frames = max_frames

    def __len__(self): return len(self.items)

    def __getitem__(self, i):
        row = self.items[i]
        kp = np.load(row["path"]).astype(np.float32)
        # Match ISLiM preprocessing: normalize x/y/z per clip, preserve confidence.
        for ch in range(3):
            v = kp[:, :, ch]
            lo, hi = float(v.min()), float(v.max())
            kp[:, :, ch] = (v - lo) / (hi - lo) if hi - lo > 1e-8 else v - lo
        n = len(kp)
        if n > self.max_frames:
            ids = np.linspace(0, n - 1, self.max_frames).round().astype(int)
            kp = kp[ids]
        return torch.from_numpy(kp), row["text"], n


def collate(batch):
    xs, texts, lengths = zip(*batch)
    t = max(len(x) for x in xs)
    out = torch.zeros((len(xs), t, 94, 4), dtype=torch.float32)
    for i, x in enumerate(xs): out[i, :len(x)] = x
    mask = torch.arange(t)[None, :] >= torch.tensor([len(x) for x in xs])[:, None]
    return out, list(texts), mask


@torch.no_grad()
def evaluate(model, loader, device, amp):
    model.eval(); preds, refs = [], []
    for kp, text, mask in loader:
        kp, mask = kp.to(device), mask.to(device)
        with torch.amp.autocast("cuda", enabled=amp):
            gen = model.generate(kp, padding_mask=mask, max_length=64, num_beams=2, repetition_penalty=1.2)
        preds.extend(gen); refs.extend(text)
    return {**compute_bleu(preds, refs), "rouge_l": compute_rouge_l(preds, refs),
            "wer": round(compute_wer(preds, refs), 2), "n": len(refs),
            "examples": [{"reference": r, "prediction": p} for p, r in list(zip(preds, refs))[:8]]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train-limit", type=int, default=2500)
    ap.add_argument("--eval-limit", type=int, default=200)
    ap.add_argument("--epochs", type=int, default=2)
    ap.add_argument("--batch-size", type=int, default=2)
    ap.add_argument("--grad-accum", type=int, default=4)
    ap.add_argument("--lr", type=float, default=5e-5)
    ap.add_argument("--clip-weight", type=float, default=0.5,
                    help="In-batch pose/text contrastive loss weight; requires batch size >= 2")
    ap.add_argument("--entropy-weight", type=float, default=0.01)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--workers", type=int, default=0)
    ap.add_argument("--resume", action="store_true")
    args = ap.parse_args()
    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)
    if torch.cuda.is_available(): torch.cuda.manual_seed_all(args.seed)
    manifests = prepare(args.train_limit, args.eval_limit, args.seed)
    train = PoseTextDataset(manifests["train"]); dev = PoseTextDataset(manifests["dev"]); test = PoseTextDataset(manifests["test"])
    train_loader = DataLoader(train, batch_size=args.batch_size, shuffle=True, collate_fn=collate, num_workers=args.workers)
    dev_loader = DataLoader(dev, batch_size=1, shuffle=False, collate_fn=collate, num_workers=args.workers)
    test_loader = DataLoader(test, batch_size=1, shuffle=False, collate_fn=collate, num_workers=args.workers)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    amp = device.type == "cuda"
    config = {"encoder": {"keypoint_dim":4,"num_keypoints":94,"temporal_channels":[376,256,256],
             "temporal_kernel":5,"transformer_embed_dim":512,"transformer_num_heads":8,
             "transformer_num_layers":4,"transformer_dropout":0.1,"output_dim":512,
             "max_frames":128,"num_query_tokens":16},
             "t5":{"t5_model":"t5-small","d_model":512,"max_target_len":64,"label_smoothing":0.05}}
    model = ISLiMModel(config).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    best = -1.0; best_score = -1.0; start = 1
    latest = OUT_DIR / "latest.pt"
    if args.resume and latest.exists():
        ck = torch.load(latest, map_location=device, weights_only=False)
        model.load_state_dict(ck["model"]); opt.load_state_dict(ck["optimizer"])
        best, start = ck["best_bleu4"], ck["epoch"] + 1
        old_val = ck.get("validation", {})
        best_score = ck.get("best_score", old_val.get("bleu4", 0.0) + old_val.get("rouge_l", 0.0) / 1000.0)
    scaler = torch.amp.GradScaler("cuda", enabled=amp)
    for epoch in range(start, args.epochs + 1):
        model.train(); opt.zero_grad(set_to_none=True); loss_sum = 0.0; tic = time.time()
        for step, (kp, texts, mask) in enumerate(train_loader, 1):
            kp, mask = kp.to(device), mask.to(device)
            with torch.amp.autocast("cuda", enabled=amp):
                if args.clip_weight > 0 and len(texts) > 1:
                    ce, clip, _, logits = model.forward_with_clip(kp, texts, padding_mask=mask)
                    _, target_mask = model._encode_target(texts, device)
                    entropy = entropy_regularization(logits, target_mask[:, :logits.size(1)])
                    raw_loss = ce + args.clip_weight * clip + args.entropy_weight * entropy
                else:
                    raw_loss = model(kp, texts, padding_mask=mask)
                loss = raw_loss / args.grad_accum
            scaler.scale(loss).backward(); loss_sum += loss.item() * args.grad_accum
            if step % args.grad_accum == 0 or step == len(train_loader):
                scaler.unscale_(opt); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                scaler.step(opt); scaler.update(); opt.zero_grad(set_to_none=True)
            if step % 100 == 0: print(f"epoch={epoch} step={step}/{len(train_loader)} loss={loss.item()*args.grad_accum:.4f}", flush=True)
        val = evaluate(model, dev_loader, device, amp)
        result = {"epoch":epoch,"train_loss":round(loss_sum/max(len(train_loader),1),4),"seconds":round(time.time()-tic,1),"validation":val}
        print(json.dumps(result, ensure_ascii=False), flush=True)
        score = val["bleu4"] + val["rouge_l"] / 1000.0
        state = {"epoch":epoch,"model":model.state_dict(),"optimizer":opt.state_dict(),"best_bleu4":best,
                 "best_score":best_score,
                 "config":config,"validation":val,"data":(POSE_DIR/"data_card.json").read_text(encoding="utf-8")}
        torch.save(state, latest)
        if score > best_score:
            best_score = score; best = max(best, val["bleu4"])
            state["best_bleu4"] = best; state["best_score"] = best_score
            best_state = {k: v for k, v in state.items() if k != "optimizer"}
            torch.save(best_state, OUT_DIR/"best_model.pt")
        (OUT_DIR/"history.jsonl").open("a",encoding="utf-8").write(json.dumps(result,ensure_ascii=False)+"\n")
    ck = torch.load(OUT_DIR/"best_model.pt", map_location=device, weights_only=False)
    model.load_state_dict(ck["model"])
    best_data = json.loads(ck.get("data", "{}"))
    final = evaluate(model, test_loader, device, amp)
    final.update({"model":"ISLiM pose encoder + T5-small, separate continuous branch", "best_epoch":ck["epoch"],
                  "validation_bleu4":ck["validation"]["bleu4"],
                  "checkpoint_training_samples":best_data.get("counts", {}).get("train"),
                  "current_training_subset":len(train),
                  "test_samples":len(test), "hardware":torch.cuda.get_device_name(0) if amp else "CPU"})
    (OUT_DIR/"test_metrics.json").write_text(json.dumps(final,indent=2,ensure_ascii=False),encoding="utf-8")
    print("FINAL_TEST",json.dumps(final,ensure_ascii=False),flush=True)


if __name__ == "__main__": main()
