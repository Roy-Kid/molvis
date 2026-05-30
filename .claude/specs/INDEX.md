<!-- Active specs. Completed specs are deleted (lifecycle); decisions of record move to .claude/notes/. -->

- [core-review-remediation](core-review-remediation.md) — code-complete — fixes from the 4-axis core review (correctness, memory, perf, robustness) landed + committed (eaa2343); blocked items tracked in notes/open-questions.md
- [camera-trajectory-turntable](camera-trajectory-turntable.md) — code-complete — pose-based turntable on a dedicated render camera + deterministic WebM export; 15/17 criteria verified, ac-016/017 (ui_runtime) owed to /mol:web
- [multi-source-overlay-01-kabsch](multi-source-overlay-01-kabsch.md) — approved — pure Kabsch superposition kernel + self-contained 3×3 SVD (no BabylonJS/WASM)
- [multi-source-overlay-03-combine](multi-source-overlay-03-combine.md) — approved — CombineSystemsModifier: concat branches + source_id + optional pairwise Kabsch align
- [multi-source-overlay-04-color](multi-source-overlay-04-color.md) — approved — categorical color-by-source via ColorByPropertyModifier (reuse)
- [multi-source-overlay-05-ui](multi-source-overlay-05-ui.md) — approved — page panel: branch picker, alignment controls, RMSD readout, color toggle
