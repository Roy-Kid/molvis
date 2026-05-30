---
slug: multi-source-overlay-04-color
criteria:
  - id: ac-001
    summary: Distinct source_id values get distinct palette colors
    type: code
    pass_when: |
      ColorByPropertyModifier with columnName="source_id", categorical=true,
      applied to an atoms block with source_id I32 [0,0,1,1,2], injects
      __color_r/g/b columns where the color triple for source_id 0 differs
      from that of 1 and of 2.
    status: pending
  - id: ac-002
    summary: Source-color mapping is deterministic by ordinal
    type: code
    pass_when: |
      Two apply() calls on identical source_id sets yield identical
      __color_r/g/b triples, and the j-th distinct source_id (natural sort)
      maps to the categorical palette entry at index j mod N.
    status: pending
  - id: ac-003
    summary: Palette cycles for more sources than palette length
    type: code
    pass_when: |
      With distinct source_id count > categorical palette length, apply()
      assigns palette[i % N] without throwing and source_id N reuses the
      same color as source_id 0.
    status: pending
  - id: ac-004
    summary: isApplicable false when source_id column absent
    type: code
    pass_when: |
      isApplicable(frame) returns false when columnName="source_id" and the
      atoms block has no source_id column; apply() returns the input frame
      unchanged (no __color_r/g/b columns injected).
    status: pending
  - id: ac-005
    summary: Numeric viridis path unchanged when categorical=false
    type: code
    pass_when: |
      With categorical=false on a numeric column, apply() still produces a
      continuous viridis ramp (existing behavior), proving no regression.
    status: pending
  - id: ac-006
    summary: Mode persists and re-applies across a redraw
    type: code
    pass_when: |
      A second apply() on the same configured modifier instance re-injects
      __color_r/g/b with colors identical to the first apply(), showing the
      modifier config (not a GPU buffer) is the source of truth.
    status: pending
  - id: ac-007
    summary: getCacheKey changes when categorical toggles
    type: code
    pass_when: |
      getCacheKey() returns different strings for categorical=true vs
      categorical=false with all other config equal.
    status: pending
  - id: ac-008
    summary: buildSourceColorLegend returns source->color list
    type: code
    pass_when: |
      buildSourceColorLegend([0,1,2]) returns 3 entries {sourceId, hex},
      each hex matching the categorical palette entry for that ordinal.
    status: pending
  - id: ac-009
    summary: Renderer reads source colors via __color override columns
    type: code
    pass_when: |
      buildAtomBuffers, given an atoms block carrying __color_r/g/b from the
      categorical source path, fills instanceColor with those override RGB
      values rather than element/type style colors.
    status: pending
  - id: ac-010
    summary: Full check and test suite pass
    type: runtime
    pass_when: |
      `npm run lint && npm run typecheck && npm test` all exit 0.
    status: pending
  - id: ac-011
    summary: Sources are visually distinct on the live canvas
    type: ui_runtime
    evaluator_hint: mol:web
    pass_when: |
      Loading a multi-source overlay with color-by-source enabled renders
      each source's atoms in a visibly different color on the canvas.
    status: pending
---

# Acceptance criteria

- ac-001..ac-003 — core categorical mapping logic: distinctness, determinism, cycling.
- ac-004..ac-005 — applicability gate and no-regression of the viridis numeric path.
- ac-006 — render-state ownership: color is re-applied from modifier config at (re)draw, never owned by the GPU buffer.
- ac-007 — cache invalidation on mode toggle.
- ac-008 — trivial source→color legend helper.
- ac-009 — buffer-fill bridge: renderer consumes the injected override columns (asserts the color reaches the renderer without a live canvas).
- ac-010 — full local check mirrors CI.
- ac-011 — single ui_runtime pixel-level confirmation; all logical correctness already covered by ac-001..ac-009.
