# Architecture

MolVis is organized as a monorepo with several packages that share a common core.

```
molvis/
├── core/        Core TypeScript library
├── page/        React web application
├── python/      Python Jupyter widget
└── vsc-ext/     VSCode extension
```

## Core Library

The core library (`@molvis/core`) provides all rendering, data processing, and interaction logic.

### MolvisApp

`MolvisApp` is the main entry point. It wires together the rendering engine, command system, modifier pipeline, mode manager, and UI.

```typescript
const app = new MolvisApp(container, config, settings);
app.start();
```

Key responsibilities:

- Creates the Babylon.js `Engine` and canvas
- Initializes `World` (scene, camera, lights)
- Manages `System` (frame, trajectory, topology)
- Coordinates `ModifierPipeline` for data transformations
- Provides the `Artist` API for high-level drawing
- Hosts the `CommandManager` for undo/redo

### Command System

All user-facing operations are implemented as **commands** with `do()` and `undo()` methods. The `CommandRegistry` stores command factories; the `CommandManager` tracks execution history.

```typescript
// Execute a registered command
app.execute('draw_frame', { frame, box });

// Undo the last command
app.commandManager.undo();
```

Built-in commands include `draw_frame`, `clear`, `set_attribute`, `new_frame`, `update_frame`, and selection operations.

### Modifier Pipeline

The `ModifierPipeline` transforms raw frame data before rendering. Modifiers are chained and computed sequentially, each receiving the output of the previous one.

```
FrameSource -> [DataSourceModifier] -> [SliceModifier] -> [SelectionModifier] -> rendered frame
```

Each modifier implements the `Modifier` interface:

```typescript
interface Modifier {
  id: string;
  name: string;
  enabled: boolean;
  apply(frame: Frame, context: PipelineContext): Frame;
}
```

Built-in modifiers:

| Modifier | Purpose |
|----------|---------|
| `DataSourceModifier` | Provides pipeline source frame state |
| `SliceModifier` | Computes per-atom visibility mask |
| `ExpressionSelectionModifier` | Selects atoms using expression syntax |
| `HideSelectionModifier` | Hides selected atoms from rendering |
| `SelectModifier` | Applies selection mask |
| `WrapPBCModifier` | Reserved periodic wrap stage (no-op in v0.0.2) |

### Interaction Modes

MolVis uses a modal interaction model. Each mode defines its own pointer/keyboard behavior:

| Mode | Purpose |
|------|---------|
| **View** | Camera orbit, pan, zoom |
| **Select** | Click/drag to select atoms and bonds |
| **Edit** | Add, delete, and modify atoms |
| **Manipulate** | Move and rotate selected groups |
| **Measure** | Distance, angle, and dihedral measurements |

Switch modes via `app.setMode('select')`.

### Mode Lifecycle Ownership

Mode lifecycle is centralized in `ModeManager`.

Transition sequence in `switch_mode(nextMode)`:

1. Return early if already in `nextMode`.
2. Call `finish()` on the current mode.
3. If leaving `Edit`, finalize the edit session.
4. If entering `Edit`, begin a new edit session.
5. Create the next mode instance and call `start()`.
6. Emit `mode-change`.

`BaseMode` constructor owns shared setup (pointer/keyboard observers and context menu). Individual modes only implement mode-specific behavior.

### Edit Session Model

Edit mode uses a staging workflow backed by `SceneIndex`.

Entering Edit:

1. `ModeManager.beginEditSession()` snapshots the current scene via `syncSceneToFrame(...)`.
2. `EditMode.start()` calls `promoteFrameToEditPool()`, moving frame entities into editable space.
3. Scene state is marked clean with `markAllSaved()`.

While Editing:

1. Add/delete/update commands mutate the edit pool (not frame data directly).
2. Right-click delete in Edit mode resolves IDs from the staged pool.
3. `Ctrl+S` triggers `syncSceneToFrame(sceneIndex, system.frame)` to persist staged edits.

Leaving Edit:

1. `ModeManager.finalizeEditSession()` checks `sceneIndex.hasUnsavedChanges`.
2. If dirty, user is prompted to keep or discard edits.
3. Keep: merge staged scene into a frame and render it.
4. Discard: restore and render the captured snapshot.
5. In both cases, manager marks scene saved and clears session snapshot.

Result: mode switches do not leak stale staged state across sessions.

### Style System

The `StyleManager` applies visual themes that control atom colors, bond widths, and background. Themes can be switched at runtime:

```typescript
app.setTheme(modernTheme);
```

## Data Model

### Frame

A `Frame` holds per-atom data (positions, elements, types) for a single snapshot. Frames are produced by readers, transformed by the pipeline, and consumed by the artist.

### Trajectory

A `Trajectory` is an ordered sequence of frames backed by a `FrameProvider`. It supports seeking, stepping forward/backward, and lazy loading via `ZarrFrameSource`.

### System

`System` owns the current frame, box, topology, and trajectory. It acts as the central data store that the rest of the application reads from.

## Rendering

MolVis renders molecules using Babylon.js with **thin instances** for performance. Atoms are drawn as impostors (screen-space spheres via custom shaders) and bonds as cylinders. The `Artist` class provides the high-level drawing API that translates frame data into scene objects.
