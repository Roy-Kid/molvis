# Change: Refactor SceneIndex Mesh and Data Separation

## Why
SceneIndex currently mixes mesh lifecycle management (register/unregister/clear) with business data storage (atom blocks, bond blocks, matrices, color buffers). This violates single responsibility principle and creates tight coupling: mesh disposal requires complex metadata cleanup, data cannot outlive meshes, and the interface keeps growing with each new data requirement.

## What Changes
- Split SceneIndex into two focused modules with 1:1 correspondence:
  - **MeshRegistry**: Describes meshes (lifecycle, type, references)
  - **EntityRegistry**: Describes mesh metadata (atoms, bonds, rendering cache)
- Each mesh in MeshRegistry has corresponding metadata in EntityRegistry (keyed by mesh.uniqueId)
- Remove all business data from mesh.metadata (keep only minimal rendering hints if needed by Babylon.js)
- Provide generic query interfaces that don't know about selection, highlighting, or other business logic

## Impact
- Affected specs: New `scene-management` capability
- Affected code: `core/src/core/scene_index.ts`, `core/src/commands/draw.ts`, `core/src/core/thin_instance.ts`, `core/src/core/scene_sync.ts`
- **BREAKING**: SceneIndex API will be split; consumers must migrate to MeshRegistry + EntityRegistry
