---
slug: multi-source-overlay-05-ui
criteria:
  - id: ac-001
    summary: getReferenceableBranches excludes self and cycle-forming branches
    type: code
    pass_when: |
      page/tests/combine_systems_logic.test.ts asserts getReferenceableBranches
      omits the modifier's own id and any id present in rejectedIds (cycle set),
      returning only valid candidates; test passes.
    status: verified
    last_checked: 2026-05-31
  - id: ac-002
    summary: formatRmsd renders 3-decimal Å string and dash for null
    type: code
    pass_when: |
      Tests assert formatRmsd(1.2345) === "1.234 Å", formatRmsd(0) === "0.000 Å",
      and formatRmsd(null) === "—"; test passes.
    status: verified
    last_checked: 2026-05-31
  - id: ac-003
    summary: buildSourceLegend maps branch ids to stable label/color pairs
    type: code
    pass_when: |
      Tests assert buildSourceLegend([]) === [] and a non-empty id list yields
      one {label,color} per id with palette colors cycling when ids exceed
      palette length; test passes.
    status: verified
    last_checked: 2026-05-31
  - id: ac-004
    summary: CombineSystems panel wired into ModifierProperties dispatch
    type: code
    pass_when: |
      ModifierProperties.tsx contains an instanceof CombineSystemsModifier branch
      rendering the CombineSystemsModifier panel component; npm run typecheck and
      npm run lint pass.
    status: verified
    last_checked: 2026-05-31
  - id: ac-005
    summary: Selecting a CombineSystems modifier renders its config panel
    type: ui_runtime
    evaluator_hint: mol:web
    pass_when: |
      With ≥2 data sources loaded, adding a CombineSystemsModifier and selecting
      it shows the branch picker, alignment controls, and color-by-source toggle
      in the properties pane styled per the sidebar design language (h-7 controls,
      text-[10px] headers).
    status: verified
    last_checked: 2026-05-31
  - id: ac-006
    summary: Toggling alignment displays per-branch RMSD-to-reference
    type: ui_runtime
    evaluator_hint: mol:web
    pass_when: |
      Enabling alignment and choosing a reference branch shows each non-reference
      branch's RMSD as a monospace "x.xxx Å" status line; the reference branch
      shows "—".
    status: pending
  - id: ac-007
    summary: Engine rejection of cyclic reference surfaces a graceful error
    type: ui_runtime
    evaluator_hint: mol:web
    pass_when: |
      Attempting a branch reference the engine rejects (cycle) leaves the panel
      intact and shows a text-destructive AlertCircle status line instead of
      crashing or applying the invalid reference.
    status: verified
    last_checked: 2026-05-31
---

# Acceptance criteria

- **ac-001 / ac-002 / ac-003** — pure UI-logic functions in `combine_systems_logic.ts`, fully unit-tested in `page/tests/`. These carry the bulk of the testable logic per the no-E2E rule.
- **ac-004** — static wiring + type/lint gate for the dispatch branch.
- **ac-005 / ac-006 / ac-007** — running-app behaviors that only `/mol:web` can verify (panel render, RMSD display, graceful engine-rejection). Kept few and concrete; no Playwright, no E2E.
