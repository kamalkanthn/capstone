# Literature survey: model decision

## Decision

Use two recognition paths because the project has two different inputs:

1. **Single isolated sign:** keep the current MobileNetV3 + BiGRU classifier. It predicts one label from a short clip/window and retains the current human-review threshold.
2. **Continuous signing:** use ISLiM as the first reproducible sequence-to-English baseline. It encodes pose landmarks with temporal convolutions and a Transformer, then generates English with T5-small. After translation, the existing browser text-to-speech layer can speak the result.

The literature survey identifies SignFlow as the closest model to the desired *real-time continuous ISL recognition* task: RGB and pose streams, a 3DResNet CNN, an 8-layer Transformer and CTC decoding. The paper reports WER 19. However, it describes its UMANG-eRaktkosh continuous corpus as newly collected because no public continuous ISL benchmark was available, and this review did not verify public training code or a checkpoint. SignFlow is therefore the strongest research reference, but it is not a model we can honestly claim to train from the materials currently in the project.

The survey table also lists roughly 95% accuracy and 100% in a new-signer scenario for SignFlow. Those figures need the exact split, sample count, and definition before they can be used as headline accuracy. The publisher abstract directly reports WER 19 and a separate detection-rate metric; WER is the safer figure to cite unless the full experimental table confirms the context of the other values.

ISLiM is selected for the next trainable branch because it directly maps continuous ISL pose to English, has public Apache-2.0 code and a training recipe for iSign, and lists pretrained weights. The paper reports BLEU-4 5.85 on iSign and approximately 384 ms mean CPU inference in its mobile study. That BLEU score is modest; it is not evidence of high translation quality. We must reproduce it with our own held-out split before reporting project performance. The linked weights must be downloaded and checked before treating them as available.

This is a task-fit and reproducibility decision, not a claim that ISLiM outperforms SignFlow. WER evaluates gloss-sequence errors; BLEU evaluates similarity of generated sentences. Their values cannot be ranked against each other.

## What the survey contributes

| Survey item | Useful finding | Decision for this project |
|---|---|---|
| 1. Systematic review (2019–2023) | CNNs learn visual features; RNN/Transformers model time; data diversity and limited datasets remain central issues. | Background only. It predates the more relevant 2025/2026 ISL work and provides no single comparable benchmark result. |
| 2. SignFlow, continuous ISL (2025) | RGB + pose, 3DResNet + Transformer + CTC; reports WER 19 and proposes a detection-rate metric. | Best task match and architecture reference. Do not report its results as ours; its continuous training corpus/code are not available in this checkout. |
| 3. GCAR graph model (2024) | Joint position + motion streams and attention can improve skeleton-based classification. | Possible isolated-sign ablation only. WLASL/PSL/MSL/ASLLVD numbers are not ISL continuous-translation evidence. |
| 4. SSTAN (2026) | Spatial and temporal attention together help dynamic sign recognition. | Research comparison only. Evaluated on WLASL/JSL/KSL, uses long training schedules and is not an ISL benchmark result. |
| 5. Text2Sign diffusion (2026) | A single-GPU sign-video generation baseline is possible. | Later text-to-sign work only. Weak prompt control and 12.6 s per clip make it unsuitable for the current live sign-to-text milestone. |
| 6. HSTE (2025) | Multi-stage spatial features and temporal modeling improve continuous gloss recognition on PHOENIX14/14-T and CSL-Daily. | Useful CSLR architecture reference. Its datasets are German/Chinese sign corpora, not ISL. |
| 7. Isharah dataset (2026) | New-signer and new-sentence evaluation exposes generalization gaps in a real-world Saudi sign dataset. | Borrow its evaluation discipline (signer-disjoint and sentence-disjoint splits); do not train this ISL system on another sign language and claim ISL accuracy. |
| 8. SL-1.5M multimodal pretraining (2025) | Large-scale pose/text pretraining improves several downstream sign tasks. | Future research direction only: no ISL training data and eight A100 GPUs are outside the current capstone setup. |
| 9. Microservice sign/text/audio proposal (2025) | Separating recognition, language processing, TTS and APIs is a useful system structure. | Keep these components modular. Its 88% claim lacks enough dataset/test details to use as an accuracy target. |
| 10. Bidirectional audiovisual translation (2025) | Recognition, speech and sign synthesis can be separate pipeline modules. | Future architecture reference. Its 84-phrase medical domain and small sign-quality study do not establish general continuous ISL performance. |

## Data and implementation gates

- The current Amrita set supports isolated signs only. It cannot train a continuous sentence model.
- ISLiM requires paired continuous pose sequences and English sentences. iSign access is gated; the account holder must accept its terms. GloSL has aligned annotations and pose files under CC BY-NC 4.0, but the full repository is listed as 232 GB. First inspect/select a documented, source-video-disjoint subset; do not download the full corpus blindly.
- Keep the continuous model unavailable in the live UI until a compatible checkpoint is present. Do not route continuous video through the isolated classifier or label its outputs as sentence translation.
- Evaluate continuous output with WER/CER for gloss or recognized-word sequences and BLEU/chrF plus human review for generated English. Report coverage, latency and signer/source-video split policy. Avoid headline “accuracy” unless the exact task and calculation are defined.
- After a continuous text result is produced, use browser TTS as a separate output layer. Regional-language translation and text-to-sign animation remain separate future stages.

## Sources

- SignFlow paper: [IEEE Access, DOI 10.1109/ACCESS.2025.3554618](https://doi.org/10.1109/ACCESS.2025.3554618).
- ISLiM paper: [ACL Anthology WSLP 2026](https://aclanthology.org/2026.wslp-1.3/); [Apache-2.0 code and training notes](https://github.com/ahmedshoaib/ISLiM).
- iSign: [ACL Findings 2024](https://aclanthology.org/2024.findings-acl.643/).
- GloSL ISL data card: [Hugging Face](https://huggingface.co/datasets/pedroodb/glosl-isl).
