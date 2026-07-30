---
spec: shared-element-picker-03-page
created: 2026-07-30
criteria:
  - id: ac-001
    summary: "Use one custom element in both edit surfaces"
    type: code
    pass_when: |
      MolvisSketch.tsx and ToolsTab.tsx render molvis-element-picker and contain no local element catalogs or periodic-table rendering.
    status: pending
  - id: ac-002
    summary: "Keep 2D picker state synchronized"
    type: runtime
    pass_when: |
      MolvisSketch browser tests select Fe through the picker, observe SketchBoardState.element "Fe", and observe keyboard-selected Cl reflected by the picker.
    status: pending
  - id: ac-003
    summary: "Keep 3D edit state synchronized"
    type: runtime
    pass_when: |
      ToolsTab browser tests select Fe through the picker and observe the existing EditMode element become exactly "Fe".
    status: pending
  - id: ac-004
    summary: "Reproduce both consumer styles"
    type: runtime
    pass_when: |
      regressions/shared-element-picker-03-page.test.ts passes with hard-coded C-to-Fe transitions for SketchBoard-style and EditMode-style consumers.
    status: pending
  - id: ac-005
    summary: "Keep page checks green"
    type: runtime
    pass_when: |
      page typecheck and page browser tests pass.
    status: pending
out_of_scope:
  - "A React implementation of the periodic table"
---

# Acceptance — shared-element-picker-03-page

完成意味着 2D 与 3D 编辑入口只做状态接线，完整 picker UI 与数据仍只有 core 一份。
