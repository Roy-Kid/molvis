---
spec: traj-ingest-03-hud
created: 2026-08-18
criteria:
  - id: ac-001
    summary: TrajectoryExtent maps the three-tuple to HUD queries
    type: runtime
    pass_when: |
      page/tests/lib/trajectory-extent.test.ts is green and asserts
      (null, 12, false, current 2) → addressableLength 12, last 11,
      readout "3/12…"; (40, 40, true, current 2) → 40 / 39 / "3/40".
    status: pending
  - id: ac-002
    summary: Filmstrip addresses only indexedLength while length is null
    type: runtime
    pass_when: |
      TrajectoryTimeline tests with totalFrames=12 and indexComplete=false
      never seekFrame >= 12 and show an ellipsis denominator.
    status: pending
  - id: ac-003
    summary: Implicit whole-trajectory analysis blocked until complete
    type: runtime
    pass_when: |
      parseScopeRange on DEFAULT_SCOPE plus a non-complete extent returns
      ok false / needs-explicit-end and does not set endInclusive to
      indexedLength-1.
    status: pending
  - id: ac-004
    summary: Scanning uses ViewerStatusOverlay; no new status bar
    type: code
    pass_when: |
      App.tsx still renders ViewerStatusOverlay; no new StatusBar
      component is added under page/src.
    status: pending
  - id: ac-005
    summary: loadFileSmart routing unchanged; scanning copy only
    type: code
    pass_when: |
      loadFileSmart still calls decideIngest and the Escape abort
      listener; onProgress text includes "frame(s) ready" when
      framesIndexedSoFar >= 1.
    status: pending
  - id: ac-006
    summary: Regression locks HUD contract goldens
    type: runtime
    pass_when: |
      node regressions/traj-ingest-03-hud.ts exits 0 and asserts
      addressableLength=12, lastSeek=11, readout "3/12…" for the
      scanning case and 40/39/"3/40" for the complete case.
    status: pending
out_of_scope:
  - traj-ingest-01-index implementation
  - Rewriting loadFileSmart / decideIngest / Esc
  - New status bar
  - Whole-trajectory file export
  - vsc-ext / Python HUD
---

# Acceptance — traj-ingest-03-hud

Done = page HUD 与 Compute scope 说三分量，扫描绝不伪装成已知终长，chrome 仍是 ViewerStatusOverlay。
