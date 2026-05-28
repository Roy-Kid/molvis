# Open Questions

Uncertain items surfaced during bootstrap or design. Resolve over time.

- **dataset-explorer spec** — `.claude/specs/dataset-explorer.md` has no
  matching `.acceptance.md`. Was it produced by `/mol:spec` or
  hand-written? If the latter, it won't work with `/mol:impl`.
- **`/mol:web` dev config** — added to `mol_project.dev`, but the
  `ready_pattern` ("Local:") and `url_pattern` regex are inferred from
  rsbuild's typical output. Verify by running `npm run dev:page` and
  confirming the printed URL matches.

## Core-review remediation — blocked future work (2026-05-28)

From the `core-review-remediation` spec. Each is blocked on a concrete
prerequisite (verified, not just hard):

- **molrs owned-copy API for handles** — freeing a `getBlock`/`simbox` handle
  corrupts the frame's shared data (proved by an RDF regression: garbage
  denormals). The per-frame wrapper "leaks" flagged in review can't be fixed in
  JS until molrs exposes a truly-owned copy or explicit handle lifetimes. See
  memory `project_molrs_handle_ownership`.
- **`ImpostorState` Mesh→uniqueId (review F6)** — unblocks unit-testing the
  promote/bond-selection path, which is a prerequisite for the C7 identity
  index-map optimization (skipping `frameIdToIndex`/`logicalToAllIndices` for
  the identity case). Currently zero test coverage there.
- **Edit-save immutability (A2 full)** — new-`Frame` swap + box preservation in
  `syncSceneToFrame`/`save()`. Same frame/box lifecycle zone as the corruption
  above; needs the edit/save path under test first.
- **Selection authority (A3)** — decide whether `SelectionManager` becomes a
  pure projection of pipeline state. Currently the clear-on-empty in
  `applyPipeline` is the intended "pipeline is authority" behavior; changing it
  is a product/design call, not a bug fix.
- **`MolvisApp` FrameRenderScheduler extraction** — the latest-wins render
  queue + position/full decision is the remaining god-object slice; needs
  integration-test scaffolding (no GPU-level test today) before refactoring.
  `SelectionReconciler` was already extracted as the safe, testable slice.
