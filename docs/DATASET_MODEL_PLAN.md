# Live ISL translation: data and model plan

## What the prototype now does

The live camera samples a rolling sequence of frames and sends it to the local API. The existing MobileNetV3 + bidirectional GRU recognizer predicts one isolated vocabulary sign per window. The browser smooths predictions into a running sequence of English labels and can speak each confirmed label with its installed speech voice.

This is a real-time **isolated-sign stream**, not a trained sentence translator. It does not infer sign boundaries reliably, decode ISL grammar, or compose sentence-level English. The installed Amrita checkpoint has 49 labels and its exploratory test report is 53.1% accuracy and 0.519 macro-F1. Its clips were randomly split because signer IDs are missing, so these numbers may be optimistic. The UI must not describe these as high-accuracy results.

## Candidate datasets

| Dataset | Best use here | Data and limitations | License/access |
|---|---|---|---|
| [GloSL ISL](https://huggingface.co/datasets/pedroodb/glosl-isl) | Primary source for continuous ISL-to-English translation | Dataset card reports 126,846 samples / 269 hours and source-video-disjoint train/dev/test splits. This workspace has the annotations and downloaded pose-only `.pose` files; raw video is not hosted in the corpus. English text is paired with pose sequences, but gloss labels are empty. | CC BY-NC 4.0; non-commercial use |
| [iSign](https://huggingface.co/datasets/Exploration-Lab/iSign) | Large paired ISL video/pose-to-text translation and text-to-pose research | More than 118K video-sentence/phrase pairs; supports SignVideo2Text, SignPose2Text, Text2Pose and related tasks. File access requires agreeing to the dataset conditions. | CC BY-NC-SA 4.0; research/non-commercial conditions |
| [ISL-CSLTR](https://data.mendeley.com/datasets/kcmpdxky7p/1) | Small sentence-level ISL translation benchmark | 700 annotated videos, 100 sentences, 7 signers. Useful for a controlled prototype/evaluation, too small to be the only training source. | Public record; verify archive terms before redistribution |
| [ISLVT](https://data.mendeley.com/datasets/98mzk82wbb/1) | Regional-language/gloss experiments and text-to-sign research | 152 videos and 76 English-Marathi-ISL gloss sentence pairs; controlled recording and limited coverage. | CC BY 4.0 |
| [INCLUDE](https://huggingface.co/datasets/ai4bharat/INCLUDE) | Isolated sign recognition pretraining/fine-tuning | Hugging Face viewer lists 3,820 training rows, 263 labels and 15 parent categories. Word clips do not teach sentence-level translation. | CC BY 4.0 |
| [Amrita SLR](https://data.mendeley.com/datasets/dtg9s785v8/1) | Current isolated-sign stream baseline and real-time camera robustness | Source reports 50 classes and 7 signers; the local archive has 978 clips in 49 folders and no signer IDs, preventing signer-disjoint evaluation. | CC BY 4.0 |

Do not combine all labels into one classifier: each corpus has a different vocabulary and annotation scheme. Keep task-specific manifests and report per-dataset results. Keep raw downloads and checkpoints out of Git; commit only scripts, manifests without private paths, and metric reports.

## Recommended multi-model design

1. **Isolated-sign recognizer (current stage):** keep the existing RGB MobileNetV3 + BiGRU for one sign per clip/window. It is a separate model and must keep its own vocabulary, threshold, and metrics.
2. **Continuous sign-to-English translator (selected next model):** use [ISLiM](https://github.com/ahmedshoaib/ISLiM), which encodes 94 pose features with temporal Conv1D layers and a Transformer, then uses T5-small to generate English directly. The paper reports BLEU-4 5.85 on iSign and about 384 ms mean CPU inference on a consumer Android phone. That is a useful reproducible research starting point, not a high-accuracy guarantee. The repository is Apache-2.0 and links pretrained weights through Google Drive; checkpoint contents and compatibility still need local verification.
3. **Continuous gloss-recognition comparison:** [SignFlow](https://doi.org/10.1109/ACCESS.2025.3554618) combines RGB CNN features, pose Transformer features, and CTC; it reports WER 19 on its Continuous ISL dataset. This predicts a gloss/word sequence rather than fluent English, and no reproducible public implementation/checkpoint was verified, so it is not the selected user-facing translator.
4. **Data and speech:** train/fine-tune the continuous translator on aligned video/pose-to-English examples from iSign or GloSL, with source-video-disjoint splits. iSign requires acceptance of its access conditions; GloSL provides 126,846 examples/269 hours under CC BY-NC 4.0, but its repository is 232 GB. Do not download the whole corpus blindly; first confirm the pose subset sizes and select a documented, group-disjoint subset if storage is limited. Keep browser TTS as a separate output layer after either model returns text.

There is no single comparable “best accuracy” score across word recognition and sentence translation. For isolated signs, report macro precision, macro recall, macro-F1, accuracy, per-class recall, latency and coverage at the rejection threshold. For sentence translation, report BLEU/chrF/ROUGE and human review; for streaming, also report time-to-first-word and end-to-end latency. Use signer-disjoint splits wherever signer identities exist, and freeze test splits before tuning.

An additional [2026 IEEE paper](https://ieeexplore.ieee.org/abstract/document/11708893) reports 96.42% accuracy, 95.31% recall and 95.59% F1 for a MediaPipe Holistic + LSTM system on INCLUDE-50. Treat those as a target to reproduce, not a directly comparable guarantee: the abstract does not establish that its split protocol, signer separation, or preprocessing matches this project. The experiment should compare that lightweight landmark sequence model with the RGB baseline on the same frozen INCLUDE-50 split before choosing the production recognizer.

## Reproduction and next training step

The local Amrita checkpoint is trained for the isolated-sign branch. A separate ISLiM model has been trained with CE, pose/text contrastive, and entropy losses. The best weights came from 600 GloSL clips; resuming on 1,500 clips did not improve validation. Its source-video-disjoint 200-clip held-out test result is BLEU-4 0.15, ROUGE-L 6.26, and WER 167.87%. Repeated generic translations show it is not ready for inference. Use the instructions in the root README to resume from `latest.pt` after improving data coverage/alignment. The continuous endpoint remains unavailable until the model passes quality review and is integrated. Do not report isolated-classifier metrics as continuous translation quality.

Research references: [iSign benchmark (ACL 2024)](https://aclanthology.org/2024.findings-acl.643/); [ISLiM (WSLP 2026)](https://aclanthology.org/2026.wslp-1.3/); [SignFlow continuous recognition (IEEE Access 2025)](https://doi.org/10.1109/ACCESS.2025.3554618); [motion-aware ISL translation (WSLP 2025)](https://aclanthology.org/2025.wslp-main.7/).
