# Amrita SLR v1 baseline experiment

Run date: 2026-10-22. This is an isolated-sign clip-classification experiment, not continuous ISL translation.

## Dataset and split

The source record reports 50 ISL signs and 7 signers and lists CC BY 4.0. The downloaded archive contains 978 videos in 49 numbered sign folders and no signer metadata. The discrepancy is unresolved. The manifest is reproducible, class-stratified, and clip-level: 684 train, 147 validation, and 147 test clips (seed 42). Signers may overlap across splits, so these scores do not establish signer-independent generalization.

Dataset citation: Sasidharan, Renjith; Rashmi, Manazhy; S Nair, Krishnaraj; N S, Heera Krishna; Muraleedharan, Karunya; Gupta Bellamkonda, Nachiketh; Manideep Rao, Suraneni; Avvari, Sohit; Bhanu Prakash, Poojari; Tejeswara Rao, Davala (2025), “Amrita SLR- Real Time ISL Dataset”, Mendeley Data, v1, [DOI 10.17632/dtg9s785v8.1](https://doi.org/10.17632/dtg9s785v8.1). See the [dataset record](https://data.mendeley.com/datasets/dtg9s785v8/1).

## Model and training

- MobileNetV3-Small pretrained RGB frame encoder plus bidirectional GRU temporal head.
- 12 uniformly sampled frames per clip; 160×160 letterboxed input.
- 20 epochs, best validation macro-F1 checkpoint, class-weighted cross-entropy, AdamW; early-stop patience 5 (the run reached its 20-epoch cap).
- CUDA on NVIDIA GeForce RTX 3050 6GB Laptop GPU; PyTorch 2.14.1+cu130.
- Training wall time: approximately 3,327 seconds.

## Clean evaluation

The initial training run mistakenly applied random brightness scaling to validation and test clips. The checkpoint was selected using those augmented validation measurements. After training, the saved checkpoint was re-evaluated on the same fixed splits **without augmentation**; those clean metrics are the figures below. Checkpoint selection may still be noisy. The current training code has been corrected so augmentation applies only to training clips.

| Split | Clips | Accuracy | Macro-F1 | Mean decode + model latency |
|---|---:|---:|---:|---:|
| Validation, clean | 147 | 53.1% | 0.525 | 198 ms/clip |
| Test, clean | 147 | 54.4% | 0.524 | 194 ms/clip |

At a validation-calibrated confidence threshold of **0.488**, validation coverage was 34.0% at 70.0% selective accuracy. On the clean test split, 32.0% of clips cleared the threshold; accuracy among those accepted predictions was 78.7%. This threshold is calibrated on in-vocabulary examples only. The dataset has no out-of-vocabulary signs, so unknown-sign rejection is untested.

The batched evaluation latency includes OpenCV video decoding and model inference after the model is loaded; it excludes browser upload and cold model loading. Single-clip API requests measured 352–393 ms after warm-up, with a 602 ms first request after server restart. A held-out clip was accepted at 68.6% confidence with the wrong top label (`you are perfect` was predicted as `monsoon`); `you are perfect` appeared second in the model’s top three. The UI lets the user select a candidate before copying or speaking it. These results show a working research baseline, not production-grade translation.

## Artifacts and reproduction

The trained checkpoint and generated metrics remain local under ignored `models/`. Clean evaluation JSON reports with per-class recall and the confusion matrix are versioned in [`experiments/`](experiments/). Reproduce preparation and training with the commands in the root README. The one-time validation-augmentation issue is specific to this checkpoint; a fresh run with the corrected trainer will produce a new model and experiment report.

## Next experiments

1. Obtain reviewed signer IDs or a dataset with signer metadata; run a signer-held-out experiment.
2. Retrain with the corrected validation transforms and compare against this checkpoint.
3. Inspect per-class errors with ISL-literate reviewers and increase the number and diversity of samples.
4. Add continuous sign recognition only after acquiring sequence annotations; keep English-to-ISL grammar and avatar animation as separately evaluated work.
