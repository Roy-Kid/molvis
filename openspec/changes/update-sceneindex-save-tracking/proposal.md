# Change: Update SceneIndex save tracking and frame serialization

## Why
Molvis needs explicit, authoritative registries for meshes and entity metadata, plus a reliable saved/unsaved flag to drive full-frame persistence. The current SceneIndex stores only metadata keyed by mesh ID and lacks a saved-state signal, making it hard to know when edits must be persisted.

## What Changes
- Add explicit `MeshRegistry` (BabylonJS Mesh) and `EntityRegistry` (metadata) as private members of `SceneIndex`, managed through SceneIndex APIs.
- Add `isSaved` flag to EntityRegistry entries; mark unsaved on any structural or attribute edits and mark all saved after a successful frame sync.
- Provide SceneIndex interfaces for querying and updating saved state.
- Use the wasm writer (`write_frame`) for Frame -> text serialization, with no delivery side effects (download/IO handled by host).

## Impact
- Affected specs: new `scene-index-registry`, new `frame-serialization`
- Affected code: `core/src/core/scene_index.ts`, `core/src/commands/draw.ts`, `core/src/mode/edit.ts`, `core/src/mode/manipulate.ts`, `core/src/core/scene_sync.ts`, and core app/command layer for serialization
