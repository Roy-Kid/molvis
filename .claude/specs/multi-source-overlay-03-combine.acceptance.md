---
slug: multi-source-overlay-03-combine
criteria:
  - id: ac-001
    summary: Output atom count equals sum of referenced branch atom counts
    type: code
    pass_when: |
      Test in core/tests/modifiers/CombineSystemsModifier.test.ts combines two
      branch frames (n0, n1 atoms) and asserts output atoms block nrows() === n0 + n1.
    status: pending
  - id: ac-002
    summary: Bond indices offset by cumulative prior-branch atom count
    type: code
    pass_when: |
      Test asserts branch-1 bonds' atomi/atomj in the output equal their
      original indices + n0, and order column is concatenated unchanged.
    status: pending
  - id: ac-003
    summary: Output atoms block carries Int32 source_id column with branch ordinals
    type: code
    pass_when: |
      Test asserts output atoms block has an Int32 column "source_id" whose values
      are 0 for branch-0 rows and 1 for branch-1 rows; a pre-existing source_id
      on a branch is overwritten with this node's ordinal.
    status: pending
  - id: ac-004
    summary: Output simbox is the reference branch's box (no union)
    type: code
    pass_when: |
      Test with distinct branch boxes asserts output.simbox matches the chosen
      reference branch's box (or first referenced branch when alignment off);
      boxes are not unioned.
    status: pending
  - id: ac-005
    summary: Alignment OFF leaves all branch coordinates unchanged
    type: code
    pass_when: |
      With alignment.enabled === false, test asserts every output x/y/z equals the
      corresponding input branch coordinate elementwise.
    status: pending
  - id: ac-006
    summary: Alignment ON restores a rotated branch onto the reference within tol
    type: scientific
    pass_when: |
      A branch pre-rotated by a known rigid transform, combined with alignment ON
      against the reference branch, yields output coords matching the reference
      within the spec-01 kernel tolerance; the test verifies the spec-01 superpose
      kernel is the path used.
    status: pending
  - id: ac-007
    summary: validate() fails when fewer than 2 branches are referenced
    type: code
    pass_when: |
      With referencedIds.length < 2, validate() returns { valid: false } with an
      error message naming the >=2 requirement.
    status: pending
  - id: ac-008
    summary: Alignment request with mismatched atom count and no subset errors clearly
    type: code
    pass_when: |
      With alignment.enabled and reference/moving branch atom counts differing and
      no selection subset, validate() (or apply()) surfaces a clear error naming
      the mismatch and the subset remedy.
    status: pending
  - id: ac-009
    summary: Topology change is signaled as full rebuild (DrawFrameCommand path)
    type: code
    pass_when: |
      Test asserts combine output atom count differs from input and that the
      pipeline change kind for this transition is "full" (never a position-only
      UpdateFrameCommand path).
    status: pending
  - id: ac-010
    summary: Modifier is registered in the Add Modifier picker
    type: code
    pass_when: |
      After registerDefaultModifiers(), ModifierRegistry.getAvailableModifiers()
      includes an entry whose factory produces a CombineSystemsModifier.
    status: pending
  - id: ac-011
    summary: Full check and test suite pass
    type: runtime
    pass_when: |
      npm run typecheck && npm run lint && npm test all exit 0.
    status: pending
---

# Acceptance criteria

- **ac-001..ac-004** lock the concat data plane: atom-count sum, bond-index
  offset, the `source_id` Int32 column representation, and reference-branch
  simbox policy (no union).
- **ac-005, ac-006** split alignment into a pure `code` off-path check and a
  `scientific` on-path numerical check that must route through the spec-01
  Kabsch kernel.
- **ac-007, ac-008** are the two `validate()` guardrails (too-few branches;
  alignment mismatch without subset).
- **ac-009** binds the CLAUDE.md invariant: topology change → `changeKind
  "full"` → `DrawFrameCommand`, never `UpdateFrameCommand`.
- **ac-010** ensures registry visibility in the picker.
- **ac-011** is the umbrella runtime gate.
