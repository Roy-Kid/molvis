---
spec: molvis-sketch-02-canvas
created: 2026-07-29
criteria:
  - id: ac-001
    summary: Element color table covers H/C/N/O/F/P/S/Cl/Br/I + gray
    type: code
    pass_when: |
      sketch/tests/style/element_colors.test.ts passes; hard-coded CPK hex
      copies for listed elements; default gray for unknown; no import of
      @molcrafts/molvis-core.
    status: pending
  - id: ac-002
    summary: ViewportCoords maps screen/doc with dpr-aware resize
    type: code
    pass_when: |
      sketch/tests/board/coords.test.ts passes; dpr=2 css 200x100 yields
      backing 400x200; screenToDoc/docToScreen round-trip error ≤ 1e-6.
    status: pending
  - id: ac-003
    summary: HitTester prefers atoms over bonds
    type: code
    pass_when: |
      sketch/tests/board/hit_test.test.ts passes; atom-in-radius and
      bond-segment hits work; overlap prefers atom; empty graph misses.
    status: pending
  - id: ac-004
    summary: SketchRenderer draws without third-party libs
    type: code
    pass_when: |
      sketch/tests/board/sketch_renderer.test.ts passes with mock 2D context;
      C omits letter by default; bond orders 1/2/3 stroke multiplicity;
      no Konva/Pixi/Fabric/Two.js imports under sketch/src/.
    status: pending
  - id: ac-005
    summary: SketchBoard tools and history work
    type: code
    pass_when: |
      sketch/tests/board/sketch_board.test.ts covers atom place, bond
      atom-to-atom, erase, select toggle, undo/redo via SketchHistory.
    status: pending
  - id: ac-006
    summary: Bond empty-drop carbon chain with single undo
    type: code
    pass_when: |
      sketch_board tests include hard-coded chain case with step 1.2;
      one undo restores pre-drag graph.
    status: pending
  - id: ac-007
    summary: Delete key removes selection when canvas focused
    type: code
    pass_when: |
      Focused canvas + selection + Delete/Backspace removes selection;
      no selection is no-op.
    status: pending
  - id: ac-008
    summary: Dirty-flag rAF does not spin while idle
    type: code
    pass_when: |
      markDirty schedules at most one rAF per dirty episode; no further
      rAF while idle after paint.
    status: pending
  - id: ac-009
    summary: Data methods delegate graph; no core/React deps
    type: code
    pass_when: |
      getMoleculeData/loadMoleculeData/toFrame match graph; package has no
      @molcrafts/molvis-core or React dependency.
    status: pending
  - id: ac-010
    summary: Public exports and jsdoc-tiered docs
    type: docs
    pass_when: |
      index exports SketchBoard, SketchTool, SKETCH_ELEMENT_COLORS; docs
      state CSS px vs document units, atom radius, C-label policy, chain step.
    status: pending
  - id: ac-011
    summary: Regression water and chain goldens pass
    type: runtime
    pass_when: |
      regressions/molvis-sketch-02-canvas.test.ts asserts water-like
      atomCount=3 bondCount=2 multiset {O,H,H}; chain step goldens;
      toFrame topology; no third-party runtime.
    status: pending
  - id: ac-012
    summary: Full check and tests pass
    type: runtime
    pass_when: |
      biome check + typecheck + tests including sketch pass.
    status: pending
out_of_scope:
  - Rings / stereo UI / marquee move / charge (phase 03)
  - page / React / shadcn
  - third-party canvas libraries
  - generate3D
---

# Acceptance — molvis-sketch-02-canvas

“完成”= 可用的原生 Canvas 画板四工具 + 碳链 + 历史 + 导出，无绘图库、无 page。
