# AI-Driven Bidirectional ISL Communication (capstone)

This is an actively developed local prototype for **live Indian Sign Language camera input, isolated-sign label streaming, and text-to-speech**. A local MobileNetV3 + bidirectional GRU classifies rolling video windows. The website displays stable English labels in order and can speak them aloud. It is not yet a sentence-level ISL translator.

## What works today

- A local browser interface for continuous camera sampling, video upload, typed text, and browser text-to-speech.
- English text and recognized isolated labels can be machine-translated to Kannada, Hindi, Tamil, Telugu, or Malayalam through the online MyMemory service. Submitted text is sent to that provider; review the automatic output. Regional speech requires a matching TTS voice installed in the browser/operating system.
- A local FastAPI service with video inference and exact one-word recorded sign-clip lookup.
- A live sliding-window camera API. The browser samples 12 frames across a short window, posts them only to the loopback API, and smooths repeated model predictions before adding a label to the transcript.
- A preparation script that builds a deterministic, class-stratified manifest from the downloaded Amrita archive.
- A train/evaluation pipeline that reports accuracy, macro-F1, per-class recall, confusion matrix, and model timing.

The current archive has **978 clips in 49 labeled folders**. The source record reports 50 classes and 7 signers, but the downloaded archive has no signer metadata and one fewer class folder. The prepared split is therefore clip-level and may place the same signer in more than one split. It must not be cited as signer-independent evaluation. The trained checkpoint stays local and is ignored by Git; the training code and measured reports are committed.

Live output is a stream of isolated English vocabulary labels, not a fluent sentence translation: the current model does not detect sentence boundaries, decode ISL grammar, or handle co-articulation. The text-to-sign path only looks up one exact vocabulary word and plays a recorded example. It does not create a sign animation or translate English grammar into ISL. Audio-to-sign and ASR remain unimplemented. These unsupported routes are labeled in the UI.

The initial clip-split baseline scores 54.4% test accuracy and 0.524 macro-F1 on 49 labels. At its validation-calibrated threshold, about 32% of test clips are accepted at 78.7% selective accuracy. These exploratory results may be optimistic because signer identity is unavailable; one end-to-end test was accepted with an incorrect label. See [`docs/BASELINE_EXPERIMENT.md`](docs/BASELINE_EXPERIMENT.md).

## Run locally

The project includes a Python virtual environment in this local checkout. From the project root:

```powershell
cd web
node server.mjs
```

Open <http://127.0.0.1:4173>. When `.venv` is present, the Node server also starts the local API on `127.0.0.1:4174`. Click **Enable camera**, allow camera access, then click **Start live recognition**. Keep the terminal process alive while using the app. The local trained checkpoint is available in this workspace; a fresh clone must train or otherwise provide an ignored checkpoint before video prediction works.

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

## Train the continuous-sign branch

The second model is ISLiM: a temporal landmark encoder with a T5-small English decoder. It is separate from the MobileNetV3 + BiGRU isolated-word model. Install its training dependencies with `.venv\Scripts\python.exe -m pip install -r requirements-training.txt`, then run `.venv\Scripts\python.exe scripts\train_continuous_islim.py --train-limit 2500 --eval-limit 200 --epochs 20 --batch-size 2 --grad-accum 4`. The script downloads pose-only clips from [GloSL ISL](https://huggingface.co/datasets/pedroodb/glosl-isl), uses its source-video-disjoint train/dev/test splits, and stores the best checkpoint under `models/continuous_islim/` (ignored by Git). Add `--resume` to continue from `latest.pt`.

The best checkpoint is from 600 training clips. Resuming with 1,500 clips did not improve validation, so the best weights were evaluated on 200 held-out clips: BLEU-4 0.15, ROUGE-L 6.26, and WER 167.87%. Predictions remain generic and repetitive. It is an experimental training result and is not connected to live camera output. Larger-scale training and sentence-quality improvements are still required. See [`docs/MODEL_SELECTION.md`](docs/MODEL_SELECTION.md) and [`models/continuous_islim/test_metrics.json`](models/continuous_islim/test_metrics.json) (local ignored artifact).

## Project documentation

- [Project audit](docs/PROJECT_AUDIT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Model selection](docs/MODEL_SELECTION.md)
- [Literature survey model decision](docs/LITERATURE_MODEL_DECISION.md)
- [Research gap analysis](docs/RESEARCH_GAP_ANALYSIS.md)
- [Implementation roadmap](docs/IMPLEMENTATION_ROADMAP.md)
- [Decisions](docs/DECISIONS.md)

## Scope and limitations

The live camera currently runs only the isolated-sign model. Continuous translation is the main next stage: ISLiM (pose encoder + Transformer + T5-small) is selected as the direct continuous-pose-to-English baseline, pending dataset access, local integration, and training. Its published score is a research reference, not a result from this project. Text-to-sign is still an exact dataset-label lookup from a recorded clip. ASR, sentence-to-ISL, and generated animation are not implemented. Regional text translation is an online layer after English text; translating isolated labels does not add ISL sentence grammar. See [`docs/MODEL_SELECTION.md`](docs/MODEL_SELECTION.md) and [`docs/DATASET_MODEL_PLAN.md`](docs/DATASET_MODEL_PLAN.md).
