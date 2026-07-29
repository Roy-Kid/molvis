---
spec: molvis-sketch-04-page
created: 2026-07-29
criteria:
  - id: ac-001
    summary: MolvisSketch unit tests exist with mocked board contract
    type: code
    pass_when: |
      page/tests/ui/modes/edit/MolvisSketch.test.tsx covers toFrame/
      getMoleculeData delegation, toolbar→board, null empty, dispose,
      molvis-sketch-container + aria-label.
    status: pending
  - id: ac-002
    summary: Page depends on workspace @molcrafts/molvis-sketch
    type: code
    pass_when: |
      page/package.json lists "@molcrafts/molvis-sketch"; TypeScript can
      import SketchBoard from that package.
    status: pending
  - id: ac-003
    summary: MolvisSketch hosts board with theme and toolbar
    type: code
    pass_when: |
      MolvisSketch.tsx exports ref { getMoleculeData, toFrame }, mounts
      SketchBoard, ResizeObserver, CSS-variable theme without invert filter,
      shadcn toolbar for board tools, ViewerOperationState, canvas
      aria-label "2D molecule sketch".
    status: pending
  - id: ac-004
    summary: MolvisSketch unit tests pass
    type: runtime
    pass_when: |
      npm run test -w page executes MolvisSketch tests successfully.
    status: pending
  - id: ac-005
    summary: BuilderTab uses toFrame then generateAndPlace
    type: code
    pass_when: |
      BuilderTab imports MolvisSketch not KekuleComposer; handleDrawing
      calls toFrame() and reuses generateAndPlace; SMILES and Download
      paths still present.
    status: pending
  - id: ac-006
    summary: Kekule fully removed from page
    type: code
    pass_when: |
      No kekule dependency; KekuleComposer, kekule-overrides, kekule-loader,
      kekule-types deleted; no --molvis-kekule-* tokens; StructureInspector
      uses .molvis-sketch-container; rsbuild has no kekule-only mocks unless
      another consumer remains.
    status: pending
  - id: ac-007
    summary: Public host API documented jsdoc-tiered
    type: docs
    pass_when: |
      MolvisSketch props and ref methods have JSDoc.
    status: pending
  - id: ac-008
    summary: Regression proves no kekule and sketch wiring
    type: runtime
    pass_when: |
      regressions/molvis-sketch-04-page.test.ts asserts package.json has
      @molcrafts/molvis-sketch not kekule; page/src zero kekule markers;
      BuilderTab references MolvisSketch and toFrame without KekuleComposer.
    status: pending
  - id: ac-009
    summary: Full check and test suite pass
    type: runtime
    pass_when: |
      biome check . && npm run typecheck && npm test succeed with
      molvis-sketch-04-page changes.
    status: pending
out_of_scope:
  - Reimplement sketch engine in page
  - generate3D inside sketch package
  - core changes
  - npm publish of sketch
---

# Acceptance — molvis-sketch-04-page

“完成”= page 产品路径完全不依赖 Kekule，2D Sketch 由 molvis-sketch + shadcn 承载，draw→generate3D→place 仍绿。
