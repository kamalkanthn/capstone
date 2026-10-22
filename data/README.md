# Data handling

No dataset is included in this workspace. Store raw video/audio outside ordinary Git history. Before use, record source URL, version/checksum, license and permitted use, vocabulary/task, signer metadata, consent/privacy terms, and expected layout in a dataset card. Do not publish participant media without explicit authorization.

The initial manifest CSV schema accepted by `scripts/validate_dataset.py` is:

`video_path,label,signer_id,split`

`video_path`, `label`, and `split` are required. `signer_id` may be blank when the source provides none. Paths are relative to the supplied dataset root. Allowed split labels are `train`, `validation`, and `test`. Keep signer and clip groups disjoint across splits when signer-independent testing is intended.
