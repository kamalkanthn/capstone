# Implementation roadmap

Updated: 2026-10-22. Status reflects files in this workspace, not a GitHub issue/milestone system.

| Phase | Deliverable | Status and evidence |
|---|---|---|
| 0. Audit and architecture | Audit, requirements, routes, architecture, research gaps, decisions | **Complete for initial baseline:** audit, architecture, gap map, decisions and model comparison drafted. A new local `main` branch and source-only commit now exist; no GitHub remote yet. |
| 1. Dataset and preprocessing | Verified data source/license, validation, ordered frame sampling, signer-aware splits | **In progress:** generic manifest validator and video sampling utility added. Amrita SLR v1 is a provisional 50-sign ISL pilot candidate, listed as CC BY 4.0; no archive downloaded and signer metadata not inspected. |
| 2. Baseline recognition | Train/eval, model artifact, reproducible metrics, inference, error analysis | **Planned:** blocked on dataset selection/access and runtime dependencies. |
| 3. Model comparison | Justified advanced temporal model, baseline comparison and profiling | **Planned:** only after Phase 2. SSTAN remains a candidate. |
| 4. Live camera | Webcam, temporal buffer, confidence rejection, performance evidence | **Planned:** requires trained model and target hardware. |
| 5. Text/speech | User-controlled TTS and optionally approved translation | **Planned:** regional language requires guide/user decision. |
| 6. Text/audio-to-ISL | ASR, constrained intermediate representation, verified sign output | **Planned:** requires suitable assets, grammar review and separate tests. |
| 7. Unified app | Mode and output selection with explicit unsupported routes | **In progress:** local browser website routes selections, previews local media, captures camera/microphone, and speaks typed text using browser TTS. Recognition/ASR/translation/sign generation routes clearly report unavailable. |
| 8. Evaluation/release | Cards, complete evaluation, CI and verified release | **Planned:** repository/remote, implementation and measured evidence absent. |

## Next gates

1. Confirm project guide approval of the Amrita SLR pilot candidate and inspect the archive's clip-level signer metadata before use.
2. Confirm project guide's permitted models/services and first target language.
3. Install/identify a Python runtime and dependencies, then run the Phase 1 utilities on a permitted sample before modeling.
4. Sign in to GitHub and create a private remote named `capstone`; push the local source-only commit and verify the remote.
