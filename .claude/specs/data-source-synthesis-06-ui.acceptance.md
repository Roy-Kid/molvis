---
slug: data-source-synthesis-06-ui
criteria:
  - id: ac-001
    summary: selectEnabledDataSources returns only enabled DataSourceModifiers as {id,name}
    type: code
    pass_when: |
      page/tests/scene_synthesis_logic.test.ts asserts selectEnabledDataSources
      filters a mixed modifier list to enabled DataSourceModifier instances,
      mapped to {id, name}; non-DataSource and disabled entries excluded.
    status: verified
    last_checked: 2026-05-31
  - id: ac-002
    summary: selectEnabledDataSources returns [] for empty/all-disabled/no-source input
    type: code
    pass_when: |
      page/tests/scene_synthesis_logic.test.ts asserts selectEnabledDataSources
      returns [] when the list is empty, when every DataSource is disabled, and
      when no DataSourceModifier is present.
    status: verified
    last_checked: 2026-05-31
  - id: ac-003
    summary: formatRmsd formats finite to 3dp+Å and null/NaN to em dash
    type: code
    pass_when: |
      page/tests/scene_synthesis_logic.test.ts asserts formatRmsd(1.2345)==="1.234 Å",
      formatRmsd(0)==="0.000 Å", formatRmsd(null)==="—", formatRmsd(NaN)==="—".
    status: verified
    last_checked: 2026-05-31
  - id: ac-004
    summary: buildSourceLegend maps ids to categorical-palette ordinal colors, wrapping
    type: code
    pass_when: |
      page/tests/scene_synthesis_logic.test.ts asserts buildSourceLegend([])===[],
      one entry per id with label===id and #RRGGBB color matching
      buildSourceColorLegend ordinals, distinct colors for distinct ordinals,
      and wrap past palette length.
    status: verified
    last_checked: 2026-05-31
  - id: ac-005
    summary: getReferenceableBranches and combine_systems_logic.ts removed
    type: code
    pass_when: |
      page/src/ui/modes/view/modifiers/combine_systems_logic.ts no longer exists;
      no source file references getReferenceableBranches; scene_synthesis_logic.ts
      exports formatRmsd, buildSourceLegend, selectEnabledDataSources only.
    status: verified
    last_checked: 2026-05-31
  - id: ac-006
    summary: CombineSystemsModifier branch removed from ModifierProperties dispatch
    type: code
    pass_when: |
      page/src/ui/modes/view/ModifierProperties.tsx has no CoreCombineSystemsModifier
      import nor instanceof branch; CombineSystemsModifier.tsx and
      useCombineSystemsState.ts deleted; npm run typecheck passes.
    status: verified
    last_checked: 2026-05-31
  - id: ac-007
    summary: Repo typechecks and full test suite passes
    type: runtime
    pass_when: |
      npm run typecheck and npm test both exit 0 with the renamed test file and
      new panel/hook/logic modules in place.
    status: verified
    last_checked: 2026-05-31
  - id: ac-008
    summary: Sources synthesis panel renders with all four sections when a source is loaded
    type: ui_runtime
    evaluator_hint: mol:web
    pass_when: |
      With ≥1 enabled data source loaded, the Pipeline tab shows a "Sources"
      SidebarSection above the pipeline list containing: data-source checklist,
      mode select (extend/augment), alignment toggle, and color-by-source toggle.
      With zero enabled sources the panel is absent.
    status: pending
  - id: ac-009
    summary: Enabling alignment reveals per-source RMSD readouts
    type: ui_runtime
    evaluator_hint: mol:web
    pass_when: |
      Toggling "Align to reference" on shows a reference-source select, a
      mass-weighted toggle, and per-source RMSD lines formatted as "N.NNN Å"
      (em dash for the reference / not-yet-computed source).
    status: pending
  - id: ac-010
    summary: Switching mode extend↔augment rebuilds the scene
    type: ui_runtime
    evaluator_hint: mol:web
    pass_when: |
      Changing the mode select between extend and augment writes the new
      SceneSynthesisConfig and the canvas re-renders (atom set changes
      accordingly) via applyPipeline fullRebuild.
    status: pending
  - id: ac-011
    summary: Color-by-source toggle recolors canvas and legend matches
    type: ui_runtime
    evaluator_hint: mol:web
    pass_when: |
      Enabling color-by-source colors atoms per source and renders a legend whose
      swatch colors match the canvas; disabling reverts coloring.
    status: pending
---

# Acceptance criteria

- ac-001..ac-004: pure-logic unit tests in `page/tests/scene_synthesis_logic.test.ts` (rstest), the only owned harness per the no-E2E rule.
- ac-005..ac-007: structural/typecheck guarantees from the rename + dispatch removal.
- ac-008..ac-011: live behaviors deferred to `/mol:web` (ui_runtime); not coverable by unit tests.
