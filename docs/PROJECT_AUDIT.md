# Project audit

Audit date: 2026-10-22. Scope: files present in the supplied `CAPSTONE` workspace.

## Repository state

At the initial audit, this directory was not a Git repository: no `.git` directory existed. In the subsequent implementation step, a local Git repository was initialized on `main` and a source-only initial commit was created. No GitHub remote exists yet; GitHub publication has not been verified. Original presentation and research binaries remain outside the staged source project. No prior history was present to preserve or reset.

## What exists

- Research/reference material: ten PDFs under `research papers/`, `ISL_Research_Notes.pdf`, `Two_Paper_Deep_Research_Report_Sign_Language_Recognition.docx`, and `Deep Research Backing Conversation for session None.docx`.
- Presentation material: `SLR_Panel_Presentation.pptx`, multiple variants under `presentation/` and `ppts/`, and the root `capstone (1).pptx`.
- The panel deck contains 12 slides. It states that research groundwork, eight-paper review, gap identification, and a shortlist were completed; implementation and evaluation are planned. It names SSTAN as the base-paper direction, not as an implemented model.

## What works / incomplete / absent

| Area | Observed state |
|---|---|
| Research and scope | Reference papers, notes, reports, and decks exist. Their claims and citations still need cross-checking against primary sources. |
| Application source | No Python/JavaScript/application source files found. |
| Dependency/configuration | No `pyproject.toml`, requirements file, environment file, or experiment configuration found. |
| Dataset | No video/audio corpus, manifest, split metadata, license record, or dataset card found. |
| Model/training | No trained model, checkpoint, training/evaluation code, or measured results found. |
| User interface / I/O | A local browser interface now previews video/audio, captures browser camera/microphone media, and uses built-in browser TTS for typed text. Recognition, ASR, translation, and ISL sign generation remain absent. |
| Tests / CI | A GitHub Actions source syntax workflow was added; it has not run on GitHub. |
| Runtime verification | Node.js is available; local web app starts and basic text-to-speech route renders. Python is unavailable in this environment, so Python utilities remain unverified. |

“Works” here means the research files are present and the panel presentation can be read. No runnable software feature was found.

## Panel deck scope and gaps

The deck's stated central question is accurate, efficient, robust recognition of dynamic signs under real-world conditions. Its four gap groups are data, model, real-world robustness, and deployment; it identifies continuous recognition, signer/environment generalization, variable signing speed, and compute cost. It lists Random Forest/LSTM/CNN/3D-CNN/Transformer/MobileNetV2/distillation candidates in the supplied task brief, while the deck compares SSTAN, multimodal 3D-ResNet+Transformer/CTC, and MobileNetV2+attention-LSTM. None is implemented in this workspace.

The deck reports results from different datasets and tasks side by side. In particular, WLASL is ASL and cannot establish ISL performance. SSTAN's reported WLASL/JSL/KSL results likewise do not establish performance on ISL. These values are literature context only, not project results or directly comparable rankings.

## Immediate findings

1. The workspace is a research bundle rather than an existing software repository.
2. No dataset/model is present, so training, accuracy, signer-independent evaluation, and latency claims are not possible.
3. A generic video sampling and manifest validation utility is the first useful implementation step; dataset selection and license review remain explicit gates before data acquisition.
4. The project needs a Git repository/remote setup to meet the GitHub source-of-truth requirement. This audit does not claim that such a repository exists.
