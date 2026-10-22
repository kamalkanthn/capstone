# Model selection

Status: provisional. No project data or benchmark has been run. Candidate papers and reported results in the presentation use differing datasets and task definitions; numbers are not comparable rankings.

| Candidate | Task fit | Benefits | Constraints / evidence limits | Decision |
|---|---|---|---|---|
| Landmark/frame classifier (non-temporal) | Sanity-check baseline for isolated signs | Cheap, simple diagnostic for whether preprocessing and labels work | Cannot satisfy dynamic-recognition objective by itself | Use only as a reference baseline, not final system. |
| Landmark temporal model (GRU/LSTM) | Isolated dynamic clips | Lightweight and interpretable starting comparison; preserves time order | Depends on quality of pose/hand extraction; landmarks can lose appearance and non-manual cues | **Primary first implementation candidate**, conditional on data availability. |
| CNN + LSTM/GRU on RGB | Isolated dynamic clips | Retains visual appearance with temporal modeling | More compute; overfit risk on small data; latency must be measured | Credible alternative if permitted RGB data and hardware support it. |
| 3D CNN / video encoder | Clip-level spatial-temporal recognition | Learns motion from RGB | Higher memory/compute; dataset and pretraining provenance matter | Defer until a valid baseline exists. |
| SSTAN stacked spatial-temporal Transformer | Skeleton/landmark dynamic sign/fingerspelling recognition | Paper describes sequential spatial and temporal attention | Reported WLASL/JSL/KSL results do not establish ISL performance; paper reports long schedules and 18.46 GMac default profile; no implementation/data in workspace | Research comparison candidate after baseline, not assumed winner. |
| Graph spatial-temporal model | Landmark sequences | Encodes skeleton structure directly | Requires reliable landmark topology; may miss RGB/facial/manual detail | Alternative for controlled ablation if dataset supports it. |
| CTC continuous recognizer (e.g. SignFlow-style RGB+pose Transformer) | Continuous gloss sequence | Appropriate when output is an ordered gloss sequence without clip-level segmentation | Requires sequence annotations; not an isolated classifier or direct natural-language translator; reported ISL results require dataset/protocol verification | Defer until sequence-labeled ISL data is verified. |
| Distillation/quantization/ONNX | Deployment optimization | Potentially reduces latency/model footprint | Can reduce accuracy; must be measured on target hardware | Defer until profiling identifies a bottleneck. |

## Initial selection

First compare a simple per-frame/landmark diagnostic with a temporal landmark model on an explicitly isolated ISL task and one fixed split. Choose frame count and feature schema only after dataset inspection. If RGB processing is permitted and feasible, add a small CNN+GRU as the stronger visual baseline. Do not begin a long SSTAN training run before validating data ingestion, split integrity, and a baseline.

## References and verification notes

- Hirooka et al., “Stack Transformer-Based Spatial-Temporal Attention Model for Dynamic Sign Language and Fingerspelling Recognition,” IEEE Open Journal of the Computer Society, 2026, DOI: [10.1109/OJCS.2026.3682330](https://doi.org/10.1109/OJCS.2026.3682330). Its abstract describes spatial MHA followed by temporal MHA; reported datasets include WLASL, JSL, KSL. This is not an ISL result.
- Geetha et al., “Toward Real-Time Recognition of Continuous Indian Sign Language: A Multi-Modal Approach Using RGB and Pose,” IEEE Access 13 (2025), DOI: [10.1109/ACCESS.2025.3554618](https://doi.org/10.1109/ACCESS.2025.3554618). This is a relevant continuous-ISL lead; verify dataset access, labels and use terms before adopting it.
- Kumari & Anand, “Isolated Video-Based Sign Language Recognition Using a Hybrid CNN-LSTM Framework Based on Attention Mechanism,” Electronics 13(7), 1229 (2024), DOI: [10.3390/electronics13071229](https://doi.org/10.3390/electronics13071229). The deck reports its WLASL-100 evaluation; WLASL is ASL and is not evidence of ISL accuracy.
