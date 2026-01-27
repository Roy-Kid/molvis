## Context
SceneIndex currently stores metadata keyed by mesh ID and relies on external scene lookups to retrieve BabylonJS Mesh instances. There is no saved-state flag, so edit operations cannot reliably indicate when a full Frame save is required. Additionally, frame serialization needs to use the wasm writer but must remain host-agnostic.

## Goals / Non-Goals
- Goals:
  - Introduce explicit MeshRegistry and EntityRegistry inside SceneIndex with one-to-one mesh ID mapping.
  - Track per-entity saved state (`isSaved`) and provide SceneIndex APIs to query and update it.
  - Mark entities unsaved on any edit operations; mark all saved after a successful frame sync.
  - Serialize Frame to text via wasm writer only (no delivery side effects).
- Non-Goals:
  - Define host delivery mechanisms (download, filesystem, event routing).
  - Introduce persistence beyond in-memory Frame serialization.

## Decisions
- SceneIndex holds two private maps keyed by `mesh.uniqueId`:
  - MeshRegistry: `Map<number, Mesh>`
  - EntityRegistry: `Map<number, EntityEntry>` (atom/bond/box/frame entries)
- EntityRegistry entries include `isSaved: boolean`.
  - Entries created from a loaded Frame are initialized `isSaved = true`.
  - Entries created or modified by edit operations are set to `isSaved = false`.
  - After successful `syncSceneToFrame`, call `SceneIndex.markAllSaved()`.
- SceneIndex provides explicit APIs for saved-state queries and updates (names TBD):
  - `isSaved(meshId)` / `hasUnsaved()`
  - `markUnsaved(meshId)` or `markAllUnsaved()`
  - `markAllSaved()`
- Frame serialization uses wasm `write_frame(frame, format)` and returns `{ format, text }` (or similar) without any IO side effects.

## Alternatives considered
- Keep MeshRef and store only mesh IDs, continuing to query the scene for meshes.
  - Rejected: requirement calls for explicit MeshRegistry storing BabylonJS Mesh objects.
- Use a global dirty flag instead of per-entity `isSaved`.
  - Rejected: requirement explicitly calls for per-entity saved state in EntityRegistry.

## Risks / Trade-offs
- Tighter coupling to BabylonJS types inside SceneIndex increases dependency surface and memory retention risk.
  - Mitigation: ensure `unregister` removes from both registries and avoids stale mesh references.
- Deletions remove entities, so per-entity `isSaved` cannot represent deleted state.
  - Mitigation: on delete operations, mark remaining entities unsaved (coarse but consistent with full-frame save).

## Migration Plan
1. Update SceneIndex to store MeshRegistry and EntityRegistry and adjust registration APIs to accept Mesh objects.
2. Update all registration call sites to pass Mesh and set initial `isSaved` correctly.
3. Add saved-state APIs and wire edit operations (add/move/delete/change element/bond order) to mark unsaved.
4. After frame sync (save), mark all entities saved.
5. Add a core serialization entry point that uses wasm `write_frame` and returns text+format.

## Open Questions
- Do we want `markAllUnsaved()` on any deletion, or only on deletions that affect topology (bonds/atoms)?
- Should thin-instance edits (if introduced later) mark the entire registry unsaved by default?
