# Core API Reference

## Package

```bash
npm install @molvis/core
```

```typescript
import { mountMolvis } from "@molvis/core";
```

## Runtime Notes (v0.0.2)

- `WrapPBCModifier` currently validates input and returns the original frame.
- `DataSourceModifier` visibility toggles are UI state only.
- `SetFrameMetaCommand` is reserved and currently a no-op.

## Entry Points

### `mountMolvis(container, config?, settings?)`

Creates and returns a `MolvisApp` instance mounted on the given HTML element.

```typescript
function mountMolvis(
  container: HTMLElement,
  config?: MolvisConfig,
  settings?: Partial<MolvisSetting>,
): MolvisApp;
```

### `Molvis` (class alias)

Re-export of `MolvisApp` for convenience.

---

## MolvisApp

The main application class.

### Constructor

```typescript
new MolvisApp(container: HTMLElement, config?: MolvisConfig, settings?: Partial<MolvisSetting>)
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `canvas` | `HTMLCanvasElement` | The rendering canvas |
| `world` | `World` | Scene, camera, and lights |
| `scene` | `Scene` | Babylon.js scene |
| `mode` | `Mode` | Current interaction mode |
| `modifierPipeline` | `ModifierPipeline` | Data transformation pipeline |
| `styleManager` | `StyleManager` | Visual theme manager |
| `gui` | `GUIManager` | UI panel manager |
| `commands` | `CommandRegistry` | Registered commands |
| `commandManager` | `CommandManager` | Undo/redo history |
| `artist` | `Artist` | High-level drawing API |
| `events` | `EventEmitter` | Application event bus |
| `settings` | `Settings` | User-facing settings |
| `system` | `System` | Frame, trajectory, and topology |
| `frame` | `Frame \| null` | Current frame (shortcut) |
| `currentFrame` | `number` | Current frame index |
| `isRunning` | `boolean` | Whether the render loop is active |

### Methods

#### Lifecycle

```typescript
app.start(): void           // Start the render loop
app.stop(): void            // Stop the render loop
app.destroy(): void         // Clean up and remove DOM elements
app.resize(): void          // Recalculate canvas size
```

#### Rendering

```typescript
app.loadFrame(frame: Frame, box?: Box): void
// Clear scene, reset history, load and render a new frame

app.renderFrame(frame: Frame, box?: Box, options?: DrawFrameOption): void
// Render a frame (updates in place for single-frame trajectories)

app.applyPipeline(options?: { fullRebuild?: boolean }): Promise<void>
// Run the modifier pipeline on the current frame and apply results
```

#### Commands

```typescript
app.execute<A, R>(name: string, args: A): R | Promise<R>
// Execute a registered command by name
```

#### Trajectory

```typescript
app.setTrajectory(trajectory: Trajectory): void  // Set trajectory, emit events
app.nextFrame(): void                             // Step forward
app.prevFrame(): void                             // Step backward
app.seekFrame(index: number): void                // Jump to frame index
```

#### Configuration

```typescript
app.setMode(mode: string): void                         // "view" | "select" | "edit" | "measure" | "manipulate"
app.setTheme(theme: Theme): void                        // Apply a visual theme
app.setConfig(config: Partial<MolvisConfig>): void      // Update runtime config
app.setSize(width: number, height: number): void        // Set display size in px
app.setRenderResolution(width: number, height: number): void  // Set canvas resolution
app.enableFitContainer(enabled: boolean): void           // Toggle 100% container fill
```

#### Mode Lifecycle Contract

- `ModeManager` owns transition control. Modes do not switch other modes directly.
- On switch, manager calls `finish()` on the previous mode, creates the new mode, then calls `start()`.
- `BaseMode` constructor attaches shared pointer/keyboard observers and context menu wiring.

#### Edit Session Contract

- Entering `edit`:
  - Manager snapshots current scene (`syncSceneToFrame`) for rollback.
  - `EditMode.start()` promotes frame entities into the edit pool (`promoteFrameToEditPool`).
- During `edit`:
  - Add/delete/update commands mutate staged scene state.
  - `Ctrl+S` saves staged state to `system.frame` via `syncSceneToFrame`.
- Leaving `edit`:
  - If staged state is dirty, manager prompts keep/discard.
  - Keep merges staged data into a frame and re-renders.
  - Discard restores the snapshot and re-renders.
  - Session snapshot is cleared after transition.

---

## Readers

### `readFrame(filename, content)`

Infers format from filename and parses a `Frame`.

```typescript
function readFrame(filename: string, content: string): Frame;
```

### Format-specific readers

```typescript
function readPDBFrame(content: string): Frame;
function readXYZFrame(content: string): Frame;
function readLAMMPSData(content: string): Frame;
```

### `inferFormatFromFilename(filename)`

Returns the format string (`"pdb"`, `"xyz"`, `"lammps-data"`) based on file extension.

---

## Writers

### `exportFrame(frame, format)`

Serializes a frame to the given format.

```typescript
function exportFrame(frame: Frame, format: ExportFormat): ExportPayload;
```

### Format-specific writers

```typescript
function writePDBFrame(frame: Frame): string;
function writeXYZFrame(frame: Frame): string;
function writeLAMMPSData(frame: Frame): string;
```

---

## Data Types

### `Frame`

Per-atom data for a single molecular snapshot (positions, elements, types). Provided by `@molcrafts/molrs` (WASM).

### `Box`

Simulation box dimensions and angles.

### `Trajectory`

Ordered sequence of frames with `next()`, `prev()`, `seek(index)`, and `currentIndex`.

### `System`

Central data store holding the current frame, box, topology, and trajectory.

### `ModeType`

Enum: `View`, `Select`, `Edit`, `Manipulate`, `Measure`.

---

## Events

The `app.events` emitter fires:

| Event | Payload | Description |
|-------|---------|-------------|
| `trajectory-change` | `Trajectory` | New trajectory loaded |
| `frame-change` | `number` | Frame index changed |
