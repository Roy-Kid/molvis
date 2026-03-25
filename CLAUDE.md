# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install all workspace dependencies
npm install

# Development servers
npm run dev:page       # Web app at localhost:3000
npm run dev:core       # Core library demo

# Build
npm run build:core     # Build core library (rslib)
npm run build:page     # Build web app (rsbuild)
npm run build:all      # Build all packages

# Test (rstest framework)
npm test               # Run core tests
npm run test:watch     # Watch mode

# Lint & Format (Biome)
npx biome check --write

# Publishing preflight
npm run release:core:check
```

## Monorepo Structure

| Package | Path | Purpose |
|---------|------|---------|
| `@molvis/core` | `core/` | Rendering engine, commands, modes, pipeline |
| `page/` | `page/` | React 19 web app (standalone + VSCode webview) |
| `vsc-ext/` | `vsc-ext/` | VSCode extension (custom editor for .pdb/.xyz/.data) |
| `python/` | `python/` | Jupyter widget |
| `electron/` | `electron/` | Desktop app (WIP) |

Dependencies flow: `page/` and `vsc-ext/` depend on `@molvis/core`. Core depends on `@babylonjs/*` and `@molcrafts/molrs` (local WASM package at `../../molrs/molrs-wasm/pkg`).

## Core Architecture

### Layer Separation

- **MolvisApp** (`app.ts`) — Orchestrator. Initializes all subsystems, provides public API (`start()`, `loadFrame()`, `setTrajectory()`, `seekFrame()`, `applyPipeline()`)
- **World** (`world.ts`) — Rendering context. BabylonJS scene, camera (ArcRotateCamera, Z-up), lights, post-processing
- **System** (`system.ts`) — Pure data layer. Owns Trajectory, manages frame navigation, emits `frame-change`/`trajectory-change` events
- **Artist** (`artist.ts`) — Graphics engine. Translates frame data into GPU thin instances. Owns singleton `atom_base_renderer` and `bond_base_renderer` meshes
- **SceneIndex** (`scene_index.ts`) — Entity registry. `ImpostorState` manages GPU buffers in two segments: frame data `[0..frameOffset)` and edit data `[frameOffset..count)`. `MetaRegistry` stores atom/bond metadata

### Command System (`commands/`)

All operations are reversible `Command<T>` objects with `do()`/`undo()`. Use `@command("name")` decorator to register.

**Critical distinction:**
- **DrawFrameCommand** = full scene rebuild (clear + render from scratch)
- **UpdateFrameCommand** = in-place buffer update only (for frame playback, never recreates ImpostorState)

Never mix these two concepts. `UpdateFrameCommand` must never call `sceneIndex.registerFrame()`.

### Mode System (`mode/`)

Five interaction modes with lifecycle: `start()` → active → `finish()`.

| Mode | Key | Purpose |
|------|-----|---------|
| View | 1 | Camera orbit/pan/zoom, grid/PBC toggle |
| Select | 2 | Click-select atoms/bonds, expression selection |
| Edit | 3 | Add/delete atoms with staging workflow |
| Manipulate | 4 | Transform selected groups |
| Measure | 5 | Distance, angle, dihedral measurements |

Edit mode uses a staging pattern: `promoteFrameToEditPool()` → edit → `syncSceneToFrame()` on exit.

### Modifier Pipeline (`pipeline/`)

Stateless chain of `Modifier` objects that transform frames before rendering. Each modifier is a pure function: `apply(frame, context) → new Frame`. Categories: `SelectionSensitive`, `SelectionInsensitive`, `Data`.

### Event System

Type-safe `EventEmitter` with key events: `frame-change`, `frame-rendered`, `trajectory-change`, `mode-change`, `selection-change`, `dirty-change`, `history-change`.

## WASM Integration (@molcrafts/molrs)

Frame and Box come from WASM. Key APIs:

```typescript
// Frame data access
const block = frame.getBlock("atoms");  // column-based data
block.nrows();
block.getColumnStrings("element");

// Box - direct property on Frame
const box = frame.simbox;  // Box | undefined

// Box creation
Box.cube(size, origin, pbc_x, pbc_y, pbc_z);
Box.ortho(lengths, origin, pbc_x, pbc_y, pbc_z);
new Box(h_matrix, origin, pbc_x, pbc_y, pbc_z);

// WASM memory: must manually free Box objects
box.free();
```

## Rendering: Thin Instances

Atoms and bonds use BabylonJS thin instances for GPU-efficient rendering. `ImpostorState` manages per-instance buffers (matrix, instanceData, instanceColor, instancePickingColor). The Picker uses ID-pass rendering: mesh ID (12 bits) + instance ID (20 bits) encoded into color for off-screen picking.

## Page (React Web App)

Three-panel layout with `react-resizable-panels`: LeftSidebar (analysis/RDF), center canvas (MolVis), RightSidebar (mode-specific panels). Uses Radix UI primitives + TailwindCSS. State from core events via `useMolvisUiState` and `useSelectionSnapshot` hooks.

## VSCode Extension

Hosts MolVis via webview with message-based communication (`HostToWebviewMessage`/`WebviewToHostMessage`). Two integration paths: CustomTextEditor for .pdb/.xyz/.data files, and standalone viewer panel. CSP requires `'wasm-unsafe-eval'` for molrs.

## Testing Patterns

Tests use rstest framework. Mock `SceneIndex` for unit tests (no BabylonJS needed). Test modifiers in isolation via `apply(frame, context)`. Selection tests check `SelectionManager.getState()`.

## Frame Transition Strategy

`FrameDiff` (`system/frame_diff.ts`) classifies frame transitions as "position" (fast buffer update) or "full" (rebuild). This determines whether `UpdateFrameCommand` or `DrawFrameCommand` is used during trajectory playback.

## Development Skills & Agents

This project includes specialized skills (`.claude/skills/`) and agents (`.claude/agents/`) for multi-agent development.

### Skills (slash commands)

| Skill | Purpose |
|-------|---------|
| `/molvis-spec <description>` | Convert natural language requirements into formal specs with design docs |
| `/molvis-impl <feature/spec>` | Orchestrate multi-agent implementation of a feature/spec |
| `/molvis-arch <scope>` | Architecture review specific to MolVis patterns |
| `/molvis-test <feature>` | Design test strategy for MolVis features |
| `/molvis-perf <scope>` | Performance analysis for rendering/WASM code |
| `/molvis-doc <scope>` | Documentation and docstring generation |
| `/molvis-review <scope>` | Comprehensive review: architecture + performance in parallel |

### Agents (subagents)

| Agent | Purpose |
|-------|---------|
| `molvis-reviewer` | Code review against MolVis-specific invariants (auto-invoked after writing code) |
| `molvis-explorer` | Codebase exploration with architecture-aware navigation |
| `molvis-planner` | Implementation planning with phased task breakdown |

### Typical Workflow
```
/molvis-spec "add angle measurement between 3 atoms"
→ review and approve the spec
/molvis-impl docs/specs/angle-measurement.md
→ parallel agents implement core + UI + tests → verify → review
```
