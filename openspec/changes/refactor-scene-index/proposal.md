# Change: Refactor SceneIndex as Pure Index Service

## Why

The current `SceneIndex` mixes responsibilities:
- Picking resolution (`resolvePickToId`)
- Bit-encoding for selection IDs
- Direct Babylon type dependency (`AbstractMesh`, `Mesh`)
- Low-level registration APIs requiring developers to understand internal maps

This proposal refactors `SceneIndex` into a **pure index/query service** with chemistry-semantic registration APIs that match draw commands.

## What Changes

1. **Remove picking logic** from SceneIndex—external picker handles `(mesh, thinIndex?)` and calls SceneIndex to query meta
2. **Remove bit-encoding utilities** from SceneIndex (move to picker if needed)
3. **Chemistry-semantic registration APIs** matching draw commands:
   - `registerFrame(options)` — View mode: thin instances for atoms+bonds (FrameMeta)
   - `registerAtom(options)` — Edit mode: individual atom mesh
   - `registerBond(options)` — Edit mode: individual bond mesh
   - `registerBox(options)` — Simulation box
4. **Unified query interface**: `getMeta(meshId, subIndex?)` returns business metadata or null
5. **Decouple from Babylon types**: use `{ uniqueId: number }` duck-typed object

**BREAKING**: All consumers of `SceneIndex` will need to migrate

## Impact

- **Affected specs**: scene-index (new capability)
- **Affected code**:
  - `molvis/core/src/core/scene_index.ts` — full rewrite
  - `molvis/core/src/core/mesh_registry.ts` — may be merged or removed
  - `molvis/core/src/core/entity_registry.ts` — may be merged or removed
  - `molvis/core/src/commands/draw.ts` — update registration calls
  - `molvis/core/src/core/selection_manager.ts` — remove picking delegation
  - `molvis/core/src/core/highlighter.ts` — use new query API
  - `molvis/core/src/core/selector.ts` — use new query API
  - `molvis/core/src/core/thin_instance.ts` — update SceneIndex usage
  - `molvis/core/src/core/scene_sync.ts` — use new query API
