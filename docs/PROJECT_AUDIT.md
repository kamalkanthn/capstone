# Project audit

Audit date: 2026-10-22. This records the original workspace audit and the current implementation checkpoint.

## Repository and source materials

The supplied workspace initially had no Git repository. A source-only Git repository was subsequently initialized on `main` and pushed to the private GitHub repository [`kamalkanthn/capstone`](https://github.com/kamalkanthn/capstone). Research and presentation binaries remain in the local workspace and are not part of the source-only Git history.

The workspace contains research PDFs and reports, a 12-slide panel deck, additional presentation variants, and the project source. The panel deck describes SSTAN as a candidate direction; it is not implemented here. Literature results, particularly ASL/WLASL results, are not project results and do not establish ISL performance.

## Current implementation state

| Area | State and evidence |
|---|---|
| Local website | Node.js server on loopback; browser video/audio preview, camera recording, typed text, and built-in browser speech. |
| Video preprocessing | Ordered fixed-length RGB frame sampler; a real archive clip decoded to a finite 12×3×160×160 tensor. |
| Data | Amrita SLR v1 archive downloaded and extracted locally. Inventory found 978 videos in 49 numbered class folders, with no signer metadata in the archive. Source record reports 50 signs and 7 signers; one class discrepancy remains unresolved. |
| Manifest | `scripts/prepare_amrita.py` creates reproducible per-class clip-stratified train/validation/test splits. `scripts/validate_dataset.py` passed against all 978 files. This is not a signer-independent protocol. |
| Model | MobileNetV3-Small visual encoder with bidirectional GRU temporal head. GPU-enabled PyTorch 2.14.1+cu130 detects the local RTX 3050. Training is underway; no accuracy claim is established until it finishes. |
| Inference API | FastAPI video upload prediction, health endpoint, and exact one-word recorded clip lookup. Local Node server starts the API when `.venv` is present after server restart. |
| Text to sign | Exact one-word lookup of a recorded dataset clip. No sentence planning, grammar conversion, generated animation, or avatar. |
| Speech/audio | Browser TTS for typed text and spoken recognized labels. ASR and audio-to-sign are absent. |
| Generalization | Signer IDs are unavailable in the archive. The pilot split is clip-level, so test signers may occur in train. Unknown-sign rejection is not calibrated with out-of-vocabulary clips. |
| CI and repo | GitHub repository exists. CI is configured but has not been reported as passing on GitHub. |

## Verification performed

- Installed and imported PyTorch, torchvision, OpenCV, FastAPI, and the local application package.
- Confirmed CUDA availability and detected NVIDIA GeForce RTX 3050 6GB Laptop GPU.
- Python bytecode compilation passed for preparation, training, API, model, and vision modules.
- Node syntax checks passed for the browser application and local server.
- Decoded one dataset clip to 12 ordered RGB frames at 160×160; all tensor values were finite.
- Generated and validated a 978-row manifest with 49 labels and train/validation/test counts 684/147/147.
- Full baseline model experiment is currently in progress; report metrics only from its saved experiment report.

## Required limitations

The present classifier handles **one isolated sign per clip**. It does not recognize continuous sentence streams or sign boundaries, generate fluent English, or establish signer-independent performance. The output clip lookup is a vocabulary demonstration only. ASR, speech-to-sign, regional-language translation, and animated/avatar sign generation remain future work.
