# Architecture

Status: proposed design; no integrated application is implemented yet.

## System overview

Select a pipeline from input and output modes. Keep visual recognition, speech recognition, text processing, translation, TTS, and sign realization independent behind small interfaces. Unsupported routes must return a user-visible unsupported-mode result.

```mermaid
flowchart LR
  UI[Mode and I/O selection] --> R{Pipeline router}
  V[Camera or video file] --> VS[Frame sampling and visual preprocessing]
  VS --> VF[Hand, body, optional face and RGB features]
  VF --> SR[Dynamic recognition]
  SR --> SD[Sequence decoding and confidence/rejection]
  SD --> TXT[Text result]
  A[Microphone or audio file] --> ASR[Speech recognition]
  ASR --> N[Text normalization and sentence analysis]
  T[Typed text] --> N
  TXT --> OUT{Requested output}
  N --> PLAN[ISL-oriented representation and supported phrase planning]
  PLAN --> SIGN[Verified sign assets / avatar]
  N --> TR[Optional approved translation]
  TR --> TTS[Optional TTS]
  OUT --> TXT
  OUT --> TTS
  OUT --> SIGN
  R --> VS
  R --> ASR
  R --> N
```

## Module responsibilities

- **UI/router:** validates the selected input/output pair and dispatches to a matching pipeline.
- **Vision/data:** samples frames at a documented target rate, preserves timestamps/order, and emits a fixed-shape or variable-length sequence with explicit missing-feature values.
- **Recognition:** model interface accepts a clip/sequence and returns ranked labels, scores, and timing where supported. Unknown/low-confidence output is a first-class result.
- **Sequence decoding:** temporal smoothing and utterance boundaries for streaming; CTC only for continuous gloss sequences with aligned sequence labels, not isolated clip classification.
- **Text processing/sign generation:** documented intermediate representation and reviewed phrase/asset coverage. Vocabulary lookup is not general English-to-ISL translation.
- **Speech/translation/output:** independent ASR, translation and TTS adapters; language and privacy limits are explicit.

## Data flow and error handling

Video flows through ordered timestamps, preprocessing, feature extraction, recognition, optional sequence decoding, then user-reviewed text/speech. Audio flows through ASR before text processing. Typed text bypasses ASR. Text/audio-to-sign uses the same constrained sentence-analysis and sign-planning interface. Missing camera/microphone, unreadable media, missing model/assets, low confidence, and unsupported routes produce actionable errors; they must not silently return a different modality.

Raw participant media stays outside ordinary Git history. Logging records technical status/timings, not private media or transcripts by default.

## Model interfaces

Initial recognition should be an isolated-sign sequence classifier until an appropriately annotated continuous ISL dataset is available. Keep RGB and landmark features separable so the baseline can test a lightweight temporal model and later compare visual features. The selected initial candidates and evidence limits are in `MODEL_SELECTION.md`.
