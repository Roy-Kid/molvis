---
spec: molvis-sketch-03-ops
created: 2026-07-29
criteria:
  - id: ac-001
    summary: Unit tests cover geometry ops keymap viewport select
    type: runtime
    pass_when: |
      sketch/tests/geometry/{ring_template,chain_builder,snap}.test.ts,
      sketch/tests/commands/ops_commands.test.ts,
      sketch/tests/board/{keymap,viewport,select_ops}.test.ts exist and pass;
      no e2e multi-module stories under sketch/tests/.
    status: pending
  - id: ac-002
    summary: Atom2D/Bond2D/MoleculeData carry charge and stereo
    type: code
    pass_when: |
      Atom2D.charge defaults to 0; Bond2D.stereo in none|up|down;
      MoleculeData export includes charge and stereo; no in-place mutation
      of caller-owned structures.
    status: pending
  - id: ac-003
    summary: Rings 3-8 and benzene place with snap-merge
    type: runtime
    pass_when: |
      PlaceRing places sizes 3..8 and benzene; click default radius, drag sets
      radius; SNAP_RADIUS reuses atoms; benzene flagged for circle render;
      unit tests assert vertex counts and merge reducing new atoms.
    status: pending
  - id: ac-004
    summary: Chain tool fixed-length carbons
    type: runtime
    pass_when: |
      Chains space at DEFAULT_BOND_LENGTH; sub-length strokes create no bonds;
      start snaps; hard-coded segment counts pass.
    status: pending
  - id: ac-005
    summary: Bond order cycle and stereo wedge/hash
    type: runtime
    pass_when: |
      Order cycles 1→2→3→1 and clears stereo on order>1; stereo only on
      single bonds; renderer draws wedge (up) and hash (down).
    status: pending
  - id: ac-006
    summary: Formal charge adjust and superscript path
    type: runtime
    pass_when: |
      AdjustAtomCharge applies ±1; export reflects value; renderer has
      charge-superscript path; unit test 0→+1→+2→+1.
    status: pending
  - id: ac-007
    summary: Multi-select marquee/shift and move
    type: runtime
    pass_when: |
      Marquee replaces selection; shift-click toggles; drag selection executes
      one MoveSelectionCommand; undo restores coordinates (tol 1e-8).
    status: pending
  - id: ac-008
    summary: Keymap pan/zoom clear fitToView
    type: runtime
    pass_when: |
      Keymap resolves 1/2/3, common elements, undo/redo, delete, escape;
      Viewport pan (middle or Space+drag) and wheel zoom cursor-anchor;
      ClearDocument empties with undo restore; fitToView sets pan/zoom to AABB.
    status: pending
  - id: ac-009
    summary: Public ops APIs have jsdoc-tiered units
    type: docs
    pass_when: |
      RingTemplate, ChainBuilder, Snap, Viewport, Keymap, new commands,
      clear/fit document SNAP_RADIUS, DEFAULT_BOND_LENGTH, and charge meaning.
    status: pending
  - id: ac-010
    summary: Regression hard-coded ops goldens pass
    type: runtime
    pass_when: |
      regressions/molvis-sketch-03-ops.test.ts uses only sketch public API;
      embeds literal atom/bond/stereo/charge expectations with provenance
      comment; no Kekule at test time.
    status: pending
  - id: ac-011
    summary: Full monorepo check and tests green
    type: runtime
    pass_when: |
      biome check . && npm run typecheck && npm test complete with zero
      failures after implementation.
    status: pending
out_of_scope:
  - Reaction arrows, freeform text, query atoms, polymer brackets
  - Full periodic-table dialog
  - SMILES clean/layout via molrs
  - Kekule migration and page wiring
  - Aromaticity perception
  - Changes outside sketch/
---

# Acceptance — molvis-sketch-03-ops

“完成”= ChemDraw 子集操作可测、可撤销、可导出，达到替代 Kekule 手绘能力（引擎层）。
