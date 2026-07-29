---
spec: molvis-sketch-01-model
created: 2026-07-29
criteria:
  - id: ac-001
    summary: Scaffold sketch package in root workspaces with scripts
    type: code
    pass_when: |
      Root package.json lists "sketch" in workspaces; sketch/package.json
      name is @molcrafts/molvis-sketch; root exposes typecheck:sketch and
      test:sketch and chains them into typecheck and test; sketch has
      rslib.config.ts, tsconfig.json, rstest.config.ts, tests/setup_wasm.ts.
    status: verified
    last_checked: 2026-07-29
  - id: ac-002
    summary: Sketch package must not depend on core/Babylon/React
    type: code
    pass_when: |
      sketch/package.json dependencies/devDependencies do not include
      @molcrafts/molvis-core, any @babylonjs/*, react, or react-dom;
      dependencies include @molcrafts/molrs.
    status: verified
    last_checked: 2026-07-29
  - id: ac-003
    summary: MoleculeGraph unit tests cover deep-copy and Frame columns
    type: code
    pass_when: |
      sketch/tests/molecule_graph.test.ts exists and asserts:
      (1) getMoleculeData returns deep copies,
      (2) toFrame atoms.element + bonds.atomi/atomj/order match BuilderTab,
      (3) toFrame→fromFrame topology round-trip for a multi-atom fixture.
    status: verified
    last_checked: 2026-07-29
  - id: ac-004
    summary: MoleculeGraph implements public MoleculeData and Frame IO API
    type: code
    pass_when: |
      sketch/src exports MoleculeGraph, Atom2D, Bond2D, MoleculeData with
      loadMoleculeData, getMoleculeData, toFrame, fromFrame; toFrame uses
      molrs Block/Frame columns element + atomi/atomj/order only as required.
    status: verified
    last_checked: 2026-07-29
  - id: ac-005
    summary: SketchHistory unit tests cover undo/redo stack semantics
    type: code
    pass_when: |
      sketch/tests/sketch_history.test.ts asserts execute/undo/redo,
      canUndo/canRedo, empty-stack false returns, and execute clears redo.
    status: verified
    last_checked: 2026-07-29
  - id: ac-006
    summary: Edit command unit tests prove do/undo symmetry
    type: code
    pass_when: |
      sketch/tests/commands/edit_commands.test.ts covers AddAtom, RemoveAtom,
      AddBond, RemoveBond do/undo restoring getMoleculeData topology.
    status: verified
    last_checked: 2026-07-29
  - id: ac-007
    summary: Independent SketchCommand and SketchHistory implementation
    type: code
    pass_when: |
      sketch/src provides SketchCommand (do/undo) and SketchHistory
      (execute/undo/redo/clearHistory) without importing @molcrafts/molvis-core;
      edit commands are classes with single-responsibility do/undo.
    status: verified
    last_checked: 2026-07-29
  - id: ac-008
    summary: JSDoc documents units and Frame column contract
    type: docs
    pass_when: |
      Public symbols MoleculeGraph, Atom2D coordinates, toFrame/fromFrame,
      and delete-atom index policy have JSDoc stating document-Å 2D units and
      BuilderTab-compatible Frame columns.
    status: verified
    last_checked: 2026-07-29
  - id: ac-009
    summary: Regression H2O topology Frame and history goldens pass
    type: runtime
    pass_when: |
      regressions/molvis-sketch-01-model.test.ts runs via the monorepo
      regressions runner and, using only sketch public API with hard-coded
      literals (no Kekule/generate3D/third-party at runtime): loads a fixed
      H2O MoleculeData, asserts toFrame columns (elements ["O","H","H"],
      two bonds order 1 with expected endpoints), fromFrame topology match,
      and one AddAtom+undo restores atom count.
    status: verified
    last_checked: 2026-07-29
  - id: ac-010
    summary: Full monorepo check and tests including sketch pass
    type: runtime
    pass_when: |
      biome check . && npm run typecheck && npm test succeed with sketch
      package included in typecheck and test graphs.
    status: verified
    last_checked: 2026-07-29
out_of_scope:
  - Canvas / pointer / ChemDraw gestures
  - Page Kekule replacement
  - core / Babylon / React dependencies
  - generate3D / parseSMILES / 3D placement
  - CPK rendering
  - Frame round-trip of charge/stereo
---

# Acceptance — molvis-sketch-01-model

本阶段“完成”= 独立 workspace 包存在，图模型 + 可逆历史 + BuilderTab 兼容 Frame IO 经单测与回归金标验证，且无 core/Babylon/React 依赖。

## AC-001 — Scaffold

根 workspaces 与脚本接线完成。

## AC-002 — Dependency boundary

仅 molrs；无 core/Babylon/React。

## AC-003 / AC-004 — MoleculeGraph

深拷贝与 Frame 列契约。

## AC-005 / AC-006 / AC-007 — History + commands

独立 do/undo，不 import core。

## AC-008 — Docs

文档 Å 与 Frame 列 JSDoc。

## AC-009 — Regression

`regressions/molvis-sketch-01-model.test.ts` 硬编码 H₂O 金值。

## AC-010 — Full suite

check + typecheck + test 绿。
