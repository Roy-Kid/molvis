---
spec: shared-element-picker-02-sketch
created: 2026-07-30
criteria:
  - id: ac-001
    summary: "Remove the standalone demo element palette"
    type: code
    pass_when: |
      sketch/examples/demo.ts contains no local ELEMENTS catalog or per-element button map and creates the core MolvisElementPickerElement instead.
    status: pending
  - id: ac-002
    summary: "Drive SketchBoard through the shared input protocol"
    type: runtime
    pass_when: |
      sketch browser tests select Fe through the custom element and observe SketchBoard element "Fe" with tool "atom".
    status: pending
  - id: ac-003
    summary: "Reproduce the sketch consumer regression"
    type: runtime
    pass_when: |
      regressions/shared-element-picker-02-sketch.test.ts passes with the hard-coded selected symbol "Fe".
    status: pending
  - id: ac-004
    summary: "Keep sketch checks green"
    type: runtime
    pass_when: |
      sketch typecheck and sketch unit tests pass.
    status: pending
out_of_scope:
  - "SketchBoard state-model changes"
---

# Acceptance — shared-element-picker-02-sketch

完成意味着 standalone Sketch 只消费 core picker 的输入协议，不再维护自己的元素选择 UI。
