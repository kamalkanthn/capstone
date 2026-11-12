# Implementation roadmap

Updated: 2026-11-11. Status is based on local code and measured evidence, not planned work.

| Phase | Deliverable | Status |
|---|---|---|
| 0. Audit and architecture | Audit, route scope, research gaps, model comparison, decisions | Complete for the pilot baseline. The private GitHub source repository is `kamalkanthn/capstone`. |
| 1. Dataset and preprocessing | License/source record, archive inventory, frame sampler, manifest | Downloaded and extracted. 978 clips across 49 class folders; source record says 50 classes. No signer IDs were found. Manifest validation passed. |
| 2. Baseline recognition | Dynamic isolated-sign model, reproducible evaluation, local inference | MobileNetV3 + BiGRU trained on CUDA. Clean test: 54.4% accuracy, 0.524 macro-F1, and 194 ms mean decode-plus-model latency per clip. Clip-level split and checkpoint-selection limitations are documented in `BASELINE_EXPERIMENT.md`. |
| 3. Signer-independent evaluation | Reviewed signer IDs, signer-held-out split, metrics | Blocked on trustworthy signer annotations or a new dataset with signer labels. Do not infer IDs from filenames without verification. |
| 4. Live camera | Stream camera windows, smooth predictions, display live labels | Implemented as repeated 12-frame local API windows with simple temporal voting and a running label transcript. These are isolated-sign predictions, not grammatical sentences. |
| 5. Text/speech | Browser TTS and user-reviewed recognized text | Browser speech is available for typed text and confirmed live sign labels. |
| 5a. Regional text translation | Translate English text/output to Indian languages | Online MyMemory machine-translation adapter supports Kannada, Hindi, Tamil, Telugu, and Malayalam. Translation sends submitted text to the provider; review output. Live isolated labels can be translated as a literal sequence, not a grammatical sentence. Non-English speech requires a matching voice installed in the browser/OS; the UI now reports missing voices instead of silently using English. |
| 6. Text/audio-to-ISL | ASR, grammar-aware gloss planning, reviewed sign output | One exact vocabulary word can look up a recorded clip. ASR, sentence-to-ISL, generated animation/avatar, and speech-to-sign are not implemented. |
| 7. Unified local app | Mode selection, API status, explicit unsupported routes | Implemented locally. API health, exact label-to-clip lookup, video upload prediction, and held-out uploads were exercised. Labels require human review. |
| 8. Evaluation and release | Error analysis, CI, documentation, source updates | Baseline metrics documented and source updates pushed to GitHub. Raw videos and model weights remain excluded from Git; broader evaluation and CI verification remain. |
| 9. Continuous sign translation | Separate sequence-to-English model trained on ISL data | Experimental ISLiM pose encoder + T5-small trained with cross-modal contrastive and entropy losses. The best checkpoint used 600 GloSL training clips; resuming over 1,500 did not improve validation. On 200 held-out clips: BLEU-4 0.15, ROUGE-L 6.26, WER 167.87%. Quality is not suitable for live use. Training script supports larger subsets and resume. |

## Next implementation gates

1. Scale continuous-model training beyond the 600-clip pilot, track held-out translation quality, and reduce generic-sentence collapse before live integration.
2. Review class labels and collect reliable signer metadata before claiming isolated-sign generalization.
3. Human-review translation quality, especially for Kannada domain terms and speech voices available on target devices.
4. Add separate ASR and sign realization only with appropriate verified data/assets and tests.
5. Keep continuous recognition, sentence-level ISL grammar, and animation as distinct phases with their own evaluation criteria.
