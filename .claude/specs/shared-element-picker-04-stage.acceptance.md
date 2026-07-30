---
spec: shared-element-picker-04-stage
created: 2026-07-30
criteria:
  - id: ac-001
    summary: "Stage renders the shared core picker"
    type: code
    pass_when: |
      The element-picker binding creates molvis-element-picker and stage contains no local edit-element options array.
    status: pending
  - id: ac-002
    summary: "Stage edit state follows picker input"
    type: runtime
    pass_when: |
      A browser test selects Fe through the picker and receives one BindingEvent whose value is exactly "Fe".
    status: pending
  - id: ac-003
    summary: "Keep Stage checks green"
    type: runtime
    pass_when: |
      Stage typecheck and the targeted browser test pass.
    status: pending
out_of_scope:
  - "A Stage-specific periodic-table renderer"
---

# Acceptance — shared-element-picker-04-stage

完成意味着 Stage 原生菜单与 page/Sketch 一样只消费 core Web Component。
