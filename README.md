# AI-Driven Bidirectional ISL Communication (capstone)

This is an actively developed local prototype for **isolated dynamic Indian Sign Language vocabulary recognition**. It samples ordered video frames and uses a MobileNetV3 frame encoder with a bidirectional GRU temporal head. It is not yet a continuous sentence translator.

## What works today

- A local browser interface for video upload, camera recording, typed text, and browser text-to-speech.
- A local FastAPI service with video inference and exact one-word recorded sign-clip lookup.
- A preparation script that builds a deterministic, class-stratified manifest from the downloaded Amrita archive.
- A train/evaluation pipeline that reports accuracy, macro-F1, per-class recall, confusion matrix, and model timing.

The current archive has **978 clips in 49 labeled folders**. The source record reports 50 classes and 7 signers, but the downloaded archive has no signer metadata and one fewer class folder. The prepared split is therefore clip-level and may place the same signer in more than one split. It must not be cited as signer-independent evaluation. No trained checkpoint is shipped until training completes.

The text-to-sign path only looks up one exact vocabulary word and plays a recorded example. It does not create a sign animation, sequence words into an ISL sentence, or translate English grammar into ISL. Audio-to-sign and ASR remain unimplemented. These unsupported routes are labeled in the UI.

## Run locally

The project includes a Python virtual environment in this local checkout. From the project root:

```powershell
cd web
node server.mjs
```

Open <http://127.0.0.1:4173>. When `.venv` is present, the Node server also starts the local API on `127.0.0.1:4174`. Camera recording requires browser permission. Keep both terminal processes alive while using the app. The API reports “model setup needed” until a checkpoint is trained.

## Reproduce the pilot

Install package dependencies if setting up a fresh checkout (Python 3.12+ recommended):

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m pip install -e .
```

Download the Amrita SLR Real-Time ISL v1 archive from its [Mendeley Data record](https://data.mendeley.com/datasets/dtg9s785v8/1), extract its video folders into `data/raw/extracted`, then run:

```powershell
.venv\Scripts\python.exe scripts/prepare_amrita.py
.venv\Scripts\python.exe scripts/validate_dataset.py data/raw/extracted data/processed/manifest.csv
.venv\Scripts\python.exe scripts/train.py --manifest data/processed/manifest.csv --data-root data/raw/extracted --epochs 20
```

The training script downloads pretrained MobileNet weights on first use. For an NVIDIA GPU, install the matching CUDA build of PyTorch from the official [PyTorch install selector](https://pytorch.org/get-started/locally/). The installed model artifact is intentionally gitignored; the code and reproducible instructions are committed.

Raw videos, generated manifests, checkpoints, and experiment outputs stay out of Git. The source record identifies the dataset as CC BY 4.0; retain dataset attribution and review the archive terms before redistribution. See [`docs/DATASET_CARD.md`](docs/DATASET_CARD.md).

## Project documentation

- [Project audit](docs/PROJECT_AUDIT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Model selection](docs/MODEL_SELECTION.md)
- [Research gap analysis](docs/RESEARCH_GAP_ANALYSIS.md)
- [Implementation roadmap](docs/IMPLEMENTATION_ROADMAP.md)
- [Decisions](docs/DECISIONS.md)

## Scope and limitations

The prototype recognizes one isolated sign per clip. It does not decode continuous signing, model sign boundaries/co-articulation, provide a calibrated open-set unknown-sign detector, or guarantee generalization to unseen signers. Text-to-sign is a word lookup from an attributed recorded dataset clip. It is not sentence translation or an avatar. ASR, speech-to-sign, regional-language translation, and generated animation are not implemented.
