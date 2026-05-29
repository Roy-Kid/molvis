# Open Questions

Uncertain items surfaced during bootstrap or design. Resolve over time.

- **dataset-explorer spec** — `.claude/specs/dataset-explorer.md` has no
  matching `.acceptance.md`. Was it produced by `/mol:spec` or
  hand-written? If the latter, it won't work with `/mol:impl`.
- **`/mol:web` dev config** — added to `mol_project.dev`, but the
  `ready_pattern` ("Local:") and `url_pattern` regex are inferred from
  rsbuild's typical output. Verify by running `npm run dev:page` and
  confirming the printed URL matches.

## Core-review remediation — follow-ups (2026-05-28, updated)

From the `core-review-remediation` spec. Most originally-deferred items are now
resolved; see the per-item status.

- **RESOLVED — Edit-save immutability (A2 full)** — `syncSceneToFrame` replaced
  by `buildFrameFromScene` (returns a new Frame, never clears the live one) with
  box preservation via the getter→setter move pattern. Callers (`save`,
  manipulate, export, writer) migrated; covered by `build_frame_from_scene.test.ts`.
- **RESOLVED — C7 identity index-maps** — `setFrameData` skips building
  `frameIdToIndex`/`logicalToAllIndices` for identity (no `frameInstanceMap`);
  identity-aware accessors (`renderIndicesForLogicalId`, `frameLogicalIds`,
  `frameLogicalToRenderEntries`) back promote + bond selection. Test net in
  `impostor_index_maps.test.ts` covers identity and multi-order promote/lookup.
- **RESOLVED — `MolvisApp` FrameRenderScheduler extraction** — the latest-wins
  render queue is now `frame_render_scheduler.ts`, unit-tested
  (`frame_render_scheduler.test.ts`) for coalescing, forceFull-upgrade, and
  error resilience. `SelectionReconciler` was the earlier extracted slice.
- **RESOLVED (design, no code change) — Selection authority (A3)** — confirmed
  working as intended: GUI selections are committed as pipeline `SelectModifier`s
  (so `selectionSet.size > 0` and they are not clobbered); `applyPipeline`'s
  clear-on-empty only affects direct-API selections, where matching pipeline
  state is the intended "pipeline is authority" contract. Not a bug. Revisit
  only if a product decision makes `SelectionManager` a pure projection.

- **OPEN (external — molrs) — owned-copy API for handles** — freeing a
  `getBlock`/`simbox` handle corrupts the frame's shared data (proved by an RDF
  regression: garbage denormals), so the per-frame wrapper "leaks" can't be
  fixed in JS. Mitigations already applied (element-column cache; no handle
  frees on hot paths). A real fix needs molrs to expose a truly-owned copy or
  explicit handle lifetimes. See memory `project_molrs_handle_ownership`.
