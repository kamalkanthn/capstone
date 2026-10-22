# Implementation roadmap

Updated: 2026-10-22. Status is based on local code and measured evidence, not planned work.

| Phase | Deliverable | Status |
|---|---|---|
| 0. Audit and architecture | Audit, route scope, research gaps, model comparison, decisions | Complete for the pilot baseline. The private GitHub source repository is `kamalkanthn/capstone`. |
| 1. Dataset and preprocessing | License/source record, archive inventory, frame sampler, manifest | Downloaded and extracted. 978 clips across 49 class folders; source record says 50 classes. No signer IDs were found. Manifest validation passed. |
| 2. Baseline recognition | Dynamic isolated-sign model, reproducible evaluation, local inference | MobileNetV3 + BiGRU trained on CUDA. Clean test: 54.4% accuracy, 0.524 macro-F1, and 194 ms mean decode-plus-model latency per clip. Clip-level split and checkpoint-selection limitations are documented in `BASELINE_EXPERIMENT.md`. |
| 3. Signer-independent evaluation | Reviewed signer IDs, signer-held-out split, metrics | Blocked on trustworthy signer annotations or a new dataset with signer labels. Do not infer IDs from filenames without verification. |
| 4. Live camera | Record a sign clip, submit, display prediction and confidence | Camera clip recording is wired to the local API. Continuous/streaming recognition and temporal smoothing are not implemented. |
| 5. Text/speech | Browser TTS and user-reviewed recognized text | Browser speech is available for typed text and isolated sign labels. No sentence recognition or translation. |
| 6. Text/audio-to-ISL | ASR, grammar-aware gloss planning, reviewed sign output | One exact vocabulary word can look up a recorded clip. ASR, sentence-to-ISL, generated animation/avatar, and speech-to-sign are not implemented. |
| 7. Unified local app | Mode selection, API status, explicit unsupported routes | Implemented locally. API health, exact label-to-clip lookup, video upload prediction, and held-out uploads were exercised. Labels require human review. |
| 8. Evaluation and release | Error analysis, CI, documentation, source updates | Baseline metrics documented and source updates pushed to GitHub. Raw videos and model weights remain excluded from Git; broader evaluation and CI verification remain. |

## Next implementation gates

1. Finish the baseline run and record the test metrics, latency, and hardware with the split protocol.
2. Review class labels and collect reliable signer metadata before claiming generalization.
3. Ask the project guide to approve the dataset/model and the first regional language before adding translation.
4. Add separate ASR and sign realization only with appropriate verified data/assets and tests.
5. Keep continuous recognition, sentence-level ISL grammar, and animation as distinct phases with their own evaluation criteria.
