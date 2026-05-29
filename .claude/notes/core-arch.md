# Core Architecture

## Layer Separation

- **MolvisApp** (`app.ts`) — Orchestrator. Initializes all subsystems, provides public API (`start()`, `loadFrame()`, `setTrajectory()`, `seekFrame()`, `applyPipeline()`)
- **World** (`world.ts`) — Rendering context. BabylonJS scene, camera (ArcRotateCamera, Z-up), lights, post-processing
- **System** (`system.ts`) — Pure data layer. Owns Trajectory, manages frame navigation, emits `frame-change`/`trajectory-change` events
- **Artist** (`artist.ts`) — Graphics engine. Translates frame data into GPU thin instances. Owns singleton `atom_base_renderer` and `bond_base_renderer` meshes
- **SceneIndex** (`scene_index.ts`) — Entity registry. `ImpostorState` manages GPU buffers in two segments: frame data `[0..frameOffset)` and edit data `[frameOffset..count)`. `MetaRegistry` stores atom/bond metadata

## Command System (`commands/`)

All operations are reversible `Command<T>` objects with `do()`/`undo()`. Use `@command("name")` decorator to register.

**Critical distinction:**
- **DrawFrameCommand** = full scene rebuild (clear + render from scratch)
- **UpdateFrameCommand** = in-place buffer update only (for frame playback, never recreates ImpostorState)

Never mix these two concepts. `UpdateFrameCommand` must never call `sceneIndex.registerFrame()`.

## Mode System (`mode/`)

Five interaction modes with lifecycle: `start()` → active → `finish()`.

| Mode | Key | Purpose |
|------|-----|---------|
| View | 1 | Camera orbit/pan/zoom, grid/PBC toggle |
| Select | 2 | Click-select atoms/bonds, expression selection |
| Edit | 3 | Add/delete atoms with staging workflow |
| Manipulate | 4 | Transform selected groups |
| Measure | 5 | Distance, angle, dihedral measurements |

Edit mode uses a staging pattern: `promoteFrameToEditPool()` → edit → `syncSceneToFrame()` on exit.

## Modifier Pipeline (`pipeline/`)

Stateless chain of `Modifier` objects that transform frames before rendering. Each modifier is a pure function: `apply(frame, context) → new Frame`. Categories: `SelectionSensitive`, `SelectionInsensitive`, `Data`.

The pipeline is the **single ingress for scene data**. Both the sidebar's "Load File" button and the backend's `scene.draw_frame` / `scene.set_trajectory` RPCs funnel through a `DataSourceModifier` at the head of the pipeline — never bypass it when loading data, otherwise downstream modifiers (selection, hide, color) never see the new frame. See `ensureDataSource()` / `ingestFramesIntoPipeline()` in `core/src/transport/rpc/router.ts`.

## RPC Router (`transport/rpc/router.ts`)

`RPCRouter` dispatches inbound JSON-RPC requests from a controller (Python, other languages) into `MolvisApp`. Two command families:

- **`scene.*` / `view.*` / `selection.*` / `snapshot.*`** — imperative, mirror the sidebar's primary actions.
- **`pipeline.*`** — CRUD on the modifier pipeline (`list`, `available_modifiers`, `add_modifier`, `remove_modifier`, `reorder_modifier`, `set_enabled`, `set_parent`, `clear`). Same semantics as clicking sidebar buttons — both paths edit the same `ModifierPipeline` instance.

Both GUI and WS commands are views onto pipeline state; neither is authoritative over the other.

## Event System

Type-safe `EventEmitter` with key events: `frame-change`, `frame-rendered`, `trajectory-change`, `mode-change`, `selection-change`, `dirty-change`, `history-change`.

## Rendering: Thin Instances

Atoms and bonds use BabylonJS thin instances for GPU-efficient rendering. `ImpostorState` manages per-instance buffers (matrix, instanceData, instanceColor, instancePickingColor). The Picker uses ID-pass rendering: mesh ID (12 bits) + instance ID (20 bits) encoded into color for off-screen picking.

## Frame Transition Strategy

`FrameDiff` (`system/frame_diff.ts`) classifies frame transitions as "position" (fast buffer update) or "full" (rebuild). This determines whether `UpdateFrameCommand` or `DrawFrameCommand` is used during trajectory playback.

## Dataset Exploration (PCA tool)

Per-frame numeric properties (`frame.meta`, e.g. ExtXYZ `key=value` comment fields) drive the PCA dataset explorer. Two `System` state slots back it:

- **`System.frameLabels`** (`Map<string, Float64Array> | null`) — descriptor columns aggregated from every frame's `meta` at load time by `aggregateFrameLabels()` (`system/frame_labels.ts`). Built inside the `System.trajectory` setter (the single scene-data ingress) so *all* load paths populate it; emitted via `frame-labels-change`. **Lazy/provider-backed trajectories are skipped** (`Trajectory.isLazy`) to preserve streaming — their `frameLabels` stays `null`.
- **`System.exploration`** (`DatasetExploration | null`) — the last PCA(+k-means) result, computed by `runExploration(frameLabels, config)` (`analysis/exploration.ts`); emitted via `exploration-change`. Both slots are identity-guarded; the trajectory setter rebuilds `frameLabels` and clears `exploration` **before** `trajectory-change` fires.

`runExploration` is **synchronous** (matches sibling `computeRdf`/`computeClusters`; WASM is already initialized) — it stacks the selected label columns into a row-major matrix and calls molrs `WasmPca2`/`WasmKMeans`, freeing handles in `finally`. The UI (`PCATool.tsx`) is a pure consumer of these slots — it no longer walks frame meta or touches WASM directly. Note: molrs `WasmPcaResult.variance()` returns near-equal components for isotropic clouds, so the documented descending order is FP-fragile at degeneracy (tests assert ordering within tolerance).
