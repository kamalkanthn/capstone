# AI-Driven Real-Time Bidirectional ISL Communication

University capstone research workspace for dynamic Indian Sign Language recognition and a longer-term bidirectional communication application.

## Current status

- **Implemented and inspected:** research/presentation materials; project audit, architecture, research gap map, decisions, and model comparison.
- **Implemented, not yet runtime-verified:** manifest validation and ordered video frame sampling utilities in `scripts/`.
- **Planned:** trained recognition model, camera application, speech/translation, text/audio-to-sign, and unified interface.

- **Local website:** implemented as a no-dependency Node.js web app in `web/`; local media preview and browser text-to-speech are available. Recognition/ASR/translation/sign generation are visibly marked unavailable until implemented.

This workspace currently has no application model, dataset, or trained weights. A local Git repository is initialized; a GitHub remote has not yet been created. Do not interpret literature metrics as project results.

## Setup

### Run the local website

From the repository root:

```powershell
cd web
node server.mjs
```

Open <http://127.0.0.1:4173>. The server binds to loopback only. No external service or dataset is required for the interface demo. Camera and microphone previews require browser permission. The page may fetch optional fonts from Google Fonts; it falls back to local system fonts when offline. `web/package.json` also defines an `npm run dev` script for environments with npm installed.

### Data utilities

Python 3.10+ is recommended. Install video preprocessing dependencies:

```powershell
python -m pip install opencv-python numpy
```

The manifest validator uses only the Python standard library. It expects `video_path,label,split` columns and an optional `signer_id` column:

```powershell
python scripts/validate_dataset.py DATASET_ROOT DATASET_ROOT/metadata.csv
```

Sample ordered frames at 8 FPS into 224×224 RGB arrays (source aspect ratio preserved with letterboxing):

```powershell
python scripts/preprocess_video.py path/to/clip.mp4 data/processed/clip.npy --fps 8 --size 224
```

The command writes a JSON sidecar with sampling timestamps. Sampling uses OpenCV's reported presentation timestamps; validate behavior on the selected codec and variable-frame-rate media before relying on precise temporal alignment.

## Data

No media is included. The provisional pilot candidate is documented in [`docs/DATASET_CARD.md`](docs/DATASET_CARD.md). Check attribution, license, archive contents, signer metadata and guide approval before acquisition. Keep raw videos outside ordinary Git history.

## Research and implementation

- [Project audit](docs/PROJECT_AUDIT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Model selection](docs/MODEL_SELECTION.md)
- [Research gap analysis](docs/RESEARCH_GAP_ANALYSIS.md)
- [Implementation roadmap](docs/IMPLEMENTATION_ROADMAP.md)
- [Decisions](docs/DECISIONS.md)

## Limitations

The first intended recognition task is isolated dynamic sign classification. Continuous recognition requires sequence annotations and sequence metrics; no such project data or implementation exists yet. ASL results on WLASL do not establish ISL performance. Sign lookup, if added, will be labeled as a constrained vocabulary/phrase demonstration rather than general English-to-ISL translation.
