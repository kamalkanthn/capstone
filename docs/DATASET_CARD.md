# Dataset card: Amrita SLR Real-Time ISL v1 (candidate)

**Status: downloaded and inventoried locally; no signer metadata found in the archive.**

- **Source:** [Mendeley Data record, version 1](https://data.mendeley.com/datasets/dtg9s785v8/1), DOI [10.17632/dtg9s785v8.1](https://doi.org/10.17632/dtg9s785v8.1)
- **License shown on source record:** CC BY 4.0. Preserve attribution and verify the record and archive terms at acquisition.
- **Suggested citation:** Sasidharan, Renjith; Rashmi, Manazhy; S Nair, Krishnaraj; N S, Heera Krishna; Muraleedharan, Karunya; Gupta Bellamkonda, Nachiketh; Manideep Rao, Suraneni; Avvari, Sohit; Bhanu Prakash, Poojari; Tejeswara Rao, Davala (2025), “Amrita SLR- Real Time ISL Dataset”, Mendeley Data, v1, DOI 10.17632/dtg9s785v8.1.
- **Reported contents:** 50 commonly used ISL signs; approximately 16 samples per class; 7 signers; varied indoor/outdoor backgrounds, devices, distance, seated/standing positions; approximately 1.36 GB archive; 1920×1080, nominal 28 FPS, roughly 56 frames/clip on average.
- **Observed archive:** 978 video clips in 49 numbered class folders. The archive contains class folders and videos, but no CSV, signer IDs, or other signer metadata. This discrepancy with the source record's reported 50 signs remains unresolved.
- **Task fit:** small isolated dynamic ISL video classification pilot and preprocessing/profile sanity check. It is not a continuous sentence recognition corpus.
- **Limitations:** small total sample count, reported 7 signers without usable signer metadata, and no basis to claim broad vocabulary coverage or real-world generalization. The generated pilot manifest uses class-stratified random clip splits; a signer may occur in multiple splits. Treat results as exploratory and potentially optimistic, not signer-independent.
- **Privacy/ethics:** raw videos are present locally under ignored `data/raw/` and are excluded from ordinary Git history. Review consent and dataset documentation before use. Use source attribution in research outputs.
- **Acquisition status:** downloaded and extracted 2026-10-22. File layout and clip count were inspected. Class labels derive from folder names; they have not been independently validated by ISL users. Archive checksum is not recorded yet.

Do not use this card as a claim that the dataset has been approved by the project guide or is already available locally.
