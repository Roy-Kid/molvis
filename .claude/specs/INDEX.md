<!-- Active specs. Completed specs are deleted (lifecycle); decisions of record move to .claude/notes/. -->

- [core-review-remediation](core-review-remediation.md) — code-complete — fixes from the 4-axis core review (correctness, memory, perf, robustness) landed + committed (eaa2343); blocked items tracked in notes/open-questions.md
- [camera-trajectory-turntable](camera-trajectory-turntable.md) — code-complete — pose-based turntable on a dedicated render camera + deterministic WebM export; 15/17 criteria verified, ac-016/017 (ui_runtime) owed to /mol:web
- [multi-source-overlay-04-color](multi-source-overlay-04-color.md) — code-complete — categorical color-by-source via ColorByPropertyModifier (reuse, survives the data-source-synthesis refactor); ac-011 (ui_runtime) owed to /mol:web once synthesis renders overlays
- [data-source-synthesis-03-synthesis-core](data-source-synthesis-03-synthesis-core.md) — code-complete — pure scene_synthesis.ts: synthesize(sources, frameIndex, config) extend/augment + broadcast/zip/error + source_id + optional Kabsch; 9/11 verified, ac-007/008 (scientific) owed to /mol:bench or /mol:close --manual
- [data-source-synthesis-05-rpc](data-source-synthesis-05-rpc.md) — approved — scene.draw_frame/set_trajectory/add_data_source under synthesis; remove pipeline.set_references; add scene.set_synthesis
- [data-source-synthesis-06-ui](data-source-synthesis-06-ui.md) — approved — scene-level SceneSynthesisPanel (sources/mode/alignment/color-by-source) replacing the CombineSystems node panel
