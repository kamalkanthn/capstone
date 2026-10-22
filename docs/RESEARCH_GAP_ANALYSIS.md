# Research gap analysis

Status: planned experiments; no project experiment has run. The panel deck identifies four broad gap groups and the master brief expands them into the items below. Published metrics are not project results.

| Gap | Existing project evidence | Intervention and experiment | Metrics/evidence | Status |
|---|---|---|---|---|
| Dynamic temporal recognition | Panel deck states static-vs-dynamic and variable speed gaps. | Build ordered clip preprocessing; compare a frame/landmark baseline with a temporal sequence model on one fixed ISL split; test sequence lengths and signing speed. | Macro-F1, per-class recall, confusion matrix, latency/FPS, speed-stratified errors. | Open; no data/model. |
| ISL data scarcity and coverage | Deck cites limited/non-standardized data and no standard continuous benchmark. | Inventory accessible ISL datasets and rights; choose a verified corpus or define consented pilot protocol; report counts and class imbalance. | Dataset card, per-class/signers counts, license/provenance, learning curves if feasible. | Open; workspace has no dataset. |
| Signer/environment generalization | Deck lists signer/gesture variability, lighting/background sensitivity. | Split by signer where metadata allows; compare with random split only as a separate diagnostic; evaluate held-out conditions. | Macro-F1/per-class recall by signer and condition; leakage audit. | Open; metadata absent. |
| Continuous recognition/co-articulation | Deck recognizes fast signing/unseen glosses as a challenge; planned WER. | First define isolated-sign task. Add continuous gloss recognition only with sequence labels and appropriate data; evaluate segmentation/decoding separately. | WER/CER and boundary errors only when references exist. | Open; no sequence annotations. |
| Real-time deployment | Deck lists compute cost, mobile/edge constraints, and long training. | Profile preprocessing, feature extraction, inference, decoding, total latency on named target hardware; optimize only after profiling. | Stage and end-to-end latency, FPS, peak memory, artifact size, accuracy tradeoff. | Open; no runtime/model. |
| Text-to-ISL correctness | Brief warns English word order is not ISL grammar; deck's output is future scope. | Start with human-reviewed supported phrases and assets; represent validated gloss/sequence rules explicitly. | Asset coverage, signer/ISL-expert review, phrase-level correctness and unsupported cases. | Open; no sign assets. |
| Bidirectional integration | Deck describes video-to-text and optional speech only; no implementation. | Build independent modules, test each before routing; test every declared supported mode pair. | Per-module success/failure and end-to-end route results. | Open; no application. |
| Regional-language accessibility | No approved target language selected in workspace. | After user/guide approval, add one language adapter and reviewed evaluation set; verify actual ASR/TTS/translation support and license. | Human-reviewed translation quality, TTS availability, latency, fallback rate. | Decision pending; no language chosen. |

No result is filled in with an estimate. Update this table only after a reproducible experiment and record its configuration in `EXPERIMENTS.md`.

## Evidence references

- Project gap framing: `SLR_Panel_Presentation.pptx`, slides 5–9 and 12 (present in the workspace; its proposed status is explicitly not implementation evidence).
- Hirooka et al., SSTAN, [IEEE DOI 10.1109/OJCS.2026.3682330](https://doi.org/10.1109/OJCS.2026.3682330): dynamic spatial/temporal landmark attention, evaluated on WLASL/JSL/KSL; not ISL evidence.
- Geetha et al., continuous ISL RGB+pose, [IEEE DOI 10.1109/ACCESS.2025.3554618](https://doi.org/10.1109/ACCESS.2025.3554618): relevant continuous gloss recognition lead; dataset acquisition and reuse terms remain to be checked.
- R et al., continuous ISL fingerspelling, [ACL Anthology 2025.wslp-main.6](https://aclanthology.org/2025.wslp-main.6/): reports aligned video/text segments and character error evaluation; this is a constrained fingerspelling task, not general sentence translation.
- Joshi et al., iSign, [Findings of ACL 2024](https://aclanthology.org/2024.findings-acl.643/): documents ISL translation benchmark scope and limitations, including imperfect sentence/video alignment and validation constraints.
