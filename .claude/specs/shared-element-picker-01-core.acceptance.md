---
spec: shared-element-picker-01-core
created: 2026-07-30
criteria:
  - id: ac-001
    summary: "Expose one complete readonly periodic-table layout"
    type: code
    pass_when: |
      PeriodicTableElements contains exactly 118 unique symbols with atomic numbers 1..118, and tests pin H, C, La, and Og to their expected grid coordinates.
    status: pending
  - id: ac-002
    summary: "Behave like an input-style custom element"
    type: runtime
    pass_when: |
      Chromium tests show value/disabled synchronization, 118 rendered element buttons, compact mode, keyboard selection, and bubbling composed input/change events.
    status: pending
  - id: ac-003
    summary: "Keep registration explicit and idempotent"
    type: code
    pass_when: |
      core/package.json exposes ./element-picker, defineMolvisElementPicker is idempotent, and importing the default core barrel does not register molvis-element-picker.
    status: pending
  - id: ac-004
    summary: "Reproduce the public picker regression"
    type: runtime
    pass_when: |
      regressions/shared-element-picker-01-core.test.ts passes with hard-coded H/C/La/Og positions and selects Fe with value exactly "Fe".
    status: pending
  - id: ac-005
    summary: "Keep core checks green"
    type: runtime
    pass_when: |
      core typecheck, core unit tests, and repository formatting checks pass.
    status: pending
out_of_scope:
  - "React wrappers and engine-specific editing state"
  - "Automatic DOM registration from the default core barrel"
---

# Acceptance — shared-element-picker-01-core

完成意味着 core 独立拥有一套可访问、可显式注册、可被任意宿主复用的周期表输入组件，
且纯数据入口与默认 barrel 保持原有副作用边界。
