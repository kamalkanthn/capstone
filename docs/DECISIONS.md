# Decisions and open questions

Updated: 2026-10-22.

## Decisions recorded

| ID | Decision | Reason / consequence |
|---|---|---|
| D-001 | Treat current workspace as research bundle, not an existing code repository. | No source, dependency files, or `.git` metadata are present. Do not claim branches, history, remote, or CI. |
| D-002 | Define the first recognition task as isolated dynamic ISL clip classification. | Continuous recognition needs sequence-level labels and boundary/sequence evaluation; neither exists in this workspace. |
| D-003 | Keep model selection provisional. | SSTAN is named by the deck, but its reported evaluations are WLASL/JSL/KSL, not ISL, and the workspace has no dataset or model code. Start with a credible temporal baseline before considering SSTAN. |
| D-004 | Use Amrita SLR Real-Time ISL v1 as the provisional Phase 1 pilot candidate; do not download it in this workspace yet. | The Mendeley Data record identifies an accessible 1.36 GB archive under CC BY 4.0, with 50 ISL signs, about 16 samples/class and 7 signers. It fits isolated dynamic recognition and varied environments, but is small. Verify archive contents, consent/attribution terms, and whether signer IDs map to clips before training. The signer count makes signer-independent evaluation weak and must be reported. |
| D-005 | Keep raw signer media outside normal Git history. | Privacy, consent, licensing and file size require explicit handling. |
| D-006 | Do not claim bidirectional translation or any recognition accuracy. | No application code, data, trained model, sign assets, or experiments exist. |

## Unresolved decisions

- Which regional language (if any) is approved by the user and project guide for the first regional-language path?
- Can the guide approve Amrita SLR v1 for academic use under CC BY 4.0, and does its downloaded archive provide usable signer IDs for clips?
- Does the project guide permit pretrained models, network services, and any speech/translation APIs? These choices affect reproducibility, privacy, and model selection.
- Which target hardware should define real-time latency measurements?
- Is the supplied workspace intended to become the GitHub repository root, or is a separate existing remote repository available?
