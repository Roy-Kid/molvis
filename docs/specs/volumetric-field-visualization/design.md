# Spec: volumetric-field-visualization

## Summary

Add electronic structure volumetric data (3D scalar fields) as a first-class object in MolVis: load cube/VASP/XSF files, attach grids to Frames, and display isosurfaces and slice planes with the same Command + Artist draw pattern used for atoms and bonds.

## Motivation

DFT/AIMD users need to visualize electron density, difference density, spin density, ELF, and local potentials alongside atomic structure. Current MolVis only renders atom/bond geometry; there is no path from a `.cube` or `CHGCAR` file to a renderable scene. This blocks the single most common electronic-structure analysis workflow.

AIMD simulations produce a time-varying density field: one grid per frame. The design must support this from the start — field data must live on `Frame`, not in a separate registry.

## Scope

**In scope (M1–M3)**:
- File parsers: Gaussian Cube (`.cube`/`.cub`), VASP volumetric family (`CHGCAR`, `LOCPOT`, `ELFCAR`), XCrySDen XSF (`.xsf`)
- Grid data attached to `Frame` via `frame.insertGrid(name, grid)` (WASM `Grid` type)
- Marching cubes isosurface extraction (TypeScript, structured grid)
- `IsosurfaceOverlay` — triangle mesh from marching cubes, single and dual (±) isosurfaces
- `SliceOverlay` — arbitrary-plane field sampling with colormap texture
- `ContourOverlay` — 2D contour lines on a slice
- Commands: `LoadVolumetricFieldCommand`, `DrawIsosurfaceCommand`, `UpdateIsosurfaceCommand`, `DrawSliceCommand`, `UpdateSliceCommand`, `RemoveFieldLayerCommand`
- SceneIndex registration of grid metadata (for AIMD per-frame density)
- View-mode Volumetric panel in right sidebar
- Periodic grid semantics (general vs periodic, redundant-point completion)
- Scene state serialization for volumetric overlays

**Out of scope**:
- Ray-marched direct volume rendering
- Unstructured grids
- Bader/QTAIM analysis
- Marching cubes migration to WASM (TypeScript first; migrate later for performance)
- Symmetry analysis, critical point search
- Custom field serialization format (deferred to M3+)
- `VolumetricFieldRegistry` — superseded by `frame.insertGrid()` / `frame.getGrid()`
- TypeScript file parsers — all format parsing is in Rust (`molrs-core/src/io/`)

---

## Architecture Mapping

### Design Principle: Grid Is the Data Object

The WASM `Grid` type (now live in `@molcrafts/molrs`) is the primary data structure. It holds:
- Spatial definition: `dim [nx,ny,nz]`, `origin [x,y,z]`, `cell` (3×3 column-major lattice vectors), `pbc [bool;3]`
- Any number of named scalar arrays: `insertArray(name, Float32Array)` / `getArray(name): WasmArray`

Field data lives on `Frame` via `frame.insertGrid(gridName, grid)` / `frame.getGrid(gridName)`.

- There is **no `VolumetricFieldRegistry`** — Trajectory already owns frames, each frame carries its grids.
- For AIMD, each frame carries its own grid (density per time step). For static DFT, the grid is attached to frame 0 (or shared via a reference frame outside the trajectory).
- `SceneIndex` registers grid metadata alongside atoms/bonds so the Artist can draw isosurfaces per-frame.

Volumetric display uses the **same draw pattern as atoms/bonds**: `Artist.drawIsosurface()` creates/updates BabylonJS meshes. Commands (`DrawIsosurfaceCommand` / `UpdateIsosurfaceCommand`) are the coordination layer. The `Overlay` system provides lifecycle management (visibility, dispose, undo-redo) — but the geometry construction belongs in `Artist` methods, not in overlay constructors.

### Layer Impact

| Layer | Impact | Files |
|-------|--------|-------|
| System (Trajectory/Frame) | **Extend** — grids already on Frame via WASM; SceneIndex registers grid metadata | `core/src/scene_index.ts` |
| Artist (GPU) | **Extend** — new `drawIsosurface()` and `drawSlice()` methods alongside `drawAtoms()`/`drawBonds()`/`drawCloud()` | `core/src/artist.ts` |
| SceneIndex | **Extend** — register/unregister grid metadata per frame (for AIMD) | `core/src/scene_index.ts` |
| Pipeline / Modifiers | **None** — volumetric display is not a frame transform | — |
| Overlay system | **Extend** — 3 new Overlay types + Props in types.ts | `core/src/overlays/types.ts`, `core/src/overlays/isosurface_overlay.ts` (new), `core/src/overlays/slice_overlay.ts` (new), `core/src/overlays/contour_overlay.ts` (new) |
| Commands | **Extend** — 6 new commands (analogous to DrawFrameCommand / UpdateFrameCommand) | `core/src/commands/volumetric.ts` (new) |
| App public API | **Extend** — expose `loadVolumetricField()` | `core/src/app.ts` |
| Events | **Extend** — new events | `core/src/events.ts` |
| Algorithms | **New subsystem** | `core/src/algo/marching_cubes.ts` (new), `core/src/algo/field_sampler.ts` (new), `core/src/algo/contour.ts` (new) |
| IO / Parsers (Rust) | **Extend molrs-core** | `molrs-core/src/io/cube.rs` (new), `molrs-core/src/io/xsf.rs` (new), `molrs-core/src/io/chgcar.rs` (exists) |
| IO / Parsers (WASM) | **Extend molrs-wasm** | `molrs-wasm/src/io/reader.rs` (extend: `CubeReader`, `CHGCARReader`, `XSFReader`) |
| Page UI | **Extend** — new Volumetric tab in View mode | `page/src/ui/modes/view/ViewPanel.tsx`, `page/src/ui/modes/view/VolumetricPanel.tsx` (new), `page/src/hooks/useVolumetricState.ts` (new) |
| VSCode extension | **Extend** — file type associations | `vsc-ext/src/extension/` |
| WASM types | **Complete** — `Grid` WASM bindings done (`molrs-wasm/src/core/grid.rs`, `frame.rs`) | `core/src/molrs-field.d.ts` (needs update) |

### Commands

**1. `LoadVolumetricFieldCommand`**

| Field | Value |
|-------|-------|
| Name | `load-volumetric-field` |
| File | `core/src/commands/volumetric.ts` |
| `do()` | `new CubeReader(content).read(0)` (or `CHGCARReader`/`XSFReader`) → WASM Frame already has Grid attached → `sceneIndex.registerGrid(gridName)` → emit `grid-loaded` |
| `undo()` | `frame.removeGrid(gridName)` → `sceneIndex.unregisterGrid(gridName)` → remove all overlays referencing this grid → emit `grid-loaded` |
| State captured | gridName, arrayName(s), overlayIds referencing this grid |
| Pattern reference | Analogous to `DrawFrameCommand` in `commands/draw.ts` |
| **WASM note** | All parsing is in Rust. The WASM Reader returns a `Frame` with grids and atoms already populated. No TypeScript-side data manipulation. |

**2. `DrawIsosurfaceCommand`**

| Field | Value |
|-------|-------|
| Name | `draw-isosurface` |
| File | `core/src/commands/volumetric.ts` |
| `do()` | `frame.getGrid(gridName)` → `artist.drawIsosurface(grid, arrayName, props)` → create `IsosurfaceOverlay` entry → `overlayManager.add(overlay)` |
| `undo()` | `overlayManager.remove(overlayId)` → `artist.disposeIsosurface(overlayId)` |
| State captured | `IsosurfaceProps`, gridName, arrayName, generated overlayId |
| Pattern reference | Analogous to `DrawFrameCommand` (full scene draw for a new entity) |
| **Critical** | `DrawIsosurfaceCommand` is for creating a new isosurface. Use `UpdateIsosurfaceCommand` for in-place parameter changes. Never mix. |

**3. `UpdateIsosurfaceCommand`**

| Field | Value |
|-------|-------|
| Name | `update-isosurface` |
| File | `core/src/commands/volumetric.ts` |
| `do()` | `artist.updateIsosurface(overlayId, newProps)` — in-place mesh update (same isovalue → noop; changed isovalue → rerun MC on existing geometry buffers) |
| `undo()` | `artist.updateIsosurface(overlayId, previousProps)` |
| State captured | previous `IsosurfaceProps` snapshot (captured before do()) |
| Pattern reference | Analogous to `UpdateFrameCommand` (buffer update only, no re-registration) |
| **Critical** | Must NEVER call `overlayManager.add()` or re-create the overlay. Buffer-only update. |

**4. `DrawSliceCommand`**

| Field | Value |
|-------|-------|
| Name | `draw-slice` |
| File | `core/src/commands/volumetric.ts` |
| `do()` | `frame.getGrid(gridName)` → `artist.drawSlice(grid, arrayName, props)` → create `SliceOverlay` → `overlayManager.add(overlay)` |
| `undo()` | `overlayManager.remove(overlayId)` → `artist.disposeSlice(overlayId)` |
| State captured | `SliceProps`, gridName, arrayName, overlayId |

**5. `UpdateSliceCommand`**

| Field | Value |
|-------|-------|
| Name | `update-slice` |
| File | `core/src/commands/volumetric.ts` |
| `do()` | `artist.updateSlice(overlayId, newProps)` — resample if plane changed; recolor if colormap/range changed |
| `undo()` | `artist.updateSlice(overlayId, previousProps)` |
| State captured | previous `SliceProps` snapshot |

**6. `RemoveFieldLayerCommand`**

| Field | Value |
|-------|-------|
| Name | `remove-field-layer` |
| File | `core/src/commands/volumetric.ts` |
| `do()` | `overlayManager.remove(overlayId)` → `artist.disposeIsosurface/disposeSlice(overlayId)` |
| `undo()` | Recreate overlay from captured props + gridName/arrayName → `artist.drawIsosurface/drawSlice(...)` |
| State captured | overlay type, all props, gridName, arrayName |
| Pattern reference | Analogous to `RemoveOverlayCommand` in `commands/overlays.ts` |

### Modifiers

**No new modifiers.** Volumetric display is not a frame transform. Field data lives on Frame's `grids` namespace.

### Mode Changes

| Field | Value |
|-------|-------|
| Mode | View |
| Events added in start() | None — volumetric panel subscribes to `grid-loaded` and `overlay-added/removed/changed` via React hook |
| Events removed in finish() | None |
| New panel | "Volumetric" tab added to `ViewPanel.tsx` |

### Events

New events in `core/src/events.ts`:

| Event | Emitter | Listeners | Payload type |
|-------|---------|-----------|--------------|
| `"grid-loaded"` | `LoadVolumetricFieldCommand` | `useVolumetricState` hook | `{ action: "added" \| "removed"; gridName: string; frameIndex: number }` |
| `"isosurface-dirty"` | `UpdateIsosurfaceCommand` | Internal (artist recompute trigger) | `{ overlayId: string }` |

Note: `overlay-added`, `overlay-changed`, `overlay-removed` already exist in `OverlayEventMap` (`core/src/overlays/types.ts`) and are reused.

### WASM Integration

- **New molrs bindings needed**: **Complete** — `Grid` WASM bindings are live in `molrs-wasm/src/core/grid.rs` and `frame.rs`
- **WASM API** (now available):
  - `new Grid(nx, ny, nz, origin: Float32Array, cell: Float32Array, pbcX, pbcY, pbcZ)`
  - `grid.insertArray(name, Float32Array)` — validates length
  - `grid.getArray(name): WasmArray | undefined` — returns shaped array `[nx,ny,nz]`
  - `grid.arrayNames(): string[]`
  - `grid.dim(): [nx,ny,nz]`, `grid.origin(): WasmArray`, `grid.cell(): WasmArray`, `grid.pbc(): Uint8Array`
  - `frame.insertGrid(name, grid)` — moves Grid into Frame (JS handle consumed)
  - `frame.getGrid(name): Grid | undefined` — returns cloned Grid
  - `frame.gridNames(): string[]`, `frame.hasGrid(name): boolean`, `frame.removeGrid(name)`
- **TypeScript declarations**: `core/src/molrs-field.d.ts` needs `Grid` class declaration added
- **Memory ownership**: `Grid` objects not yet inserted into a Frame must be freed: `grid.free()`. After `frame.insertGrid(name, grid)`, the Grid is owned by the Frame — do NOT call `grid.free()`.
- **`getGrid()` returns a clone**: The TypeScript `Grid` returned by `frame.getGrid()` is an independent copy; freeing it does not affect the Frame's copy. Algorithms that need raw data should call `grid.getArray(name).toCopy()` to get a `Float32Array`.

### ImpostorState Impact

- **New entity types added to scene**: No — isosurface and slice meshes use BabylonJS `Mesh` directly (same as `cloudMesh`, box meshes). They bypass ImpostorState.
- **Segment affected**: None
- **Buffer dimensions change**: No

---

## Design

### Coordinate System Contract

All internal computation uses this convention (MUST be respected by all parsers). This matches the molrs `Grid.voxel_position()` formula:

```
world_position(i, j, k) = origin + (i/nx)*col0 + (j/ny)*col1 + (k/nz)*col2
```

Where:
- `col0`, `col1`, `col2` are the three **column** vectors of the cell matrix
- `cell: Float32Array[9]` is stored column-major: `cell[0..3]` = col0, `cell[3..6]` = col1, `cell[6..9]` = col2
- `origin: [x, y, z]` = Cartesian world-space position of voxel (0,0,0) in Ångström
- Axis ordering: `data[ix * ny * nz + iy * nz + iz]` — ix outermost (row-major, C order)
- `grid_type: "general"` — `i` ranges `[0, nx-1]`, no redundant boundary
- `grid_type: "periodic"` — grid has an extra row/column/plane that duplicates index 0

Parsers MUST normalize to this convention. No parser is allowed to define its own axis order.

**Reference**: This exactly matches `molrs_core::grid::Grid::voxel_position(ix,iy,iz)`.

### Data Model

**WASM `Grid`** is the data object — there is no `ParsedVolumetricResult` or `VolumetricField` TypeScript class.

WASM Readers return a `Frame` directly. The Frame already has:
- `frame.gridNames()` listing available grids
- `frame.getGrid(name)` returning the `Grid` with named arrays
- `frame.getBlock("atoms")` if the format includes atomic structure (Cube, XSF)

```typescript
type FieldDisplayPreset =
  | "density"     // single positive isosurface, blue
  | "difference"  // red/blue dual isosurface
  | "spin"        // green/orange dual isosurface
  | "elf"         // warm colormap single surface
  | "potential"   // diverging colormap slice
  | "generic";
```

**Field statistics** — computed on demand from a raw `Float32Array`, not stored:

```typescript
// core/src/algo/field_stats.ts
interface VolumetricFieldStats {
  min: number; max: number; mean: number; std: number;
  percentiles: { p1: number; p5: number; p95: number; p99: number };
}
function computeFieldStats(data: Float32Array): VolumetricFieldStats
```

**SceneIndex grid metadata** — `core/src/scene_index.ts` extended with:

```typescript
interface GridMeta {
  gridName: string;
  arrayNames: string[];
  displayPreset: FieldDisplayPreset;
  stats: VolumetricFieldStats;  // computed once at load time
}
// MetaRegistry extended:
grids: Map<string, GridMeta>;
```

**New Overlay Props** — `core/src/overlays/types.ts`

```typescript
interface IsosurfaceProps {
  readonly gridName: string;
  readonly arrayName: string;
  isovalue: number;
  color: string;            // CSS hex
  opacity: number;          // 0–1
  showNegative: boolean;    // dual isosurface
  negativeIsovalue: number;
  negativeColor: string;
  name?: string;
}

interface SliceProps {
  readonly gridName: string;
  readonly arrayName: string;
  normal: [number, number, number];      // world-space plane normal (unit vector)
  position: number;                      // signed distance from origin along normal
  colormap: "viridis" | "RdBu" | "plasma" | "grayscale" | "coolwarm";
  rangeMin: number | "auto";
  rangeMax: number | "auto";
  opacity: number;
  showContours: boolean;
  contourLevels: number[];               // explicit levels; empty = auto
  name?: string;
}
```

### Artist Extensions

`Artist.ts` gains four new methods (all operate on BabylonJS `Mesh`, not ImpostorState):

```typescript
// Draw new isosurface mesh; returns BabylonJS Mesh stored keyed by overlayId
drawIsosurface(grid: Grid, arrayName: string, props: IsosurfaceProps, overlayId: string): Mesh

// In-place buffer update (analogous to updateFrameBuffers)
updateIsosurface(overlayId: string, props: IsosurfaceProps): void

// Draw new slice plane mesh + DynamicTexture
drawSlice(grid: Grid, arrayName: string, props: SliceProps, overlayId: string): Mesh

// In-place texture update
updateSlice(overlayId: string, props: SliceProps): void

// Dispose helpers
disposeIsosurface(overlayId: string): void
disposeSlice(overlayId: string): void
```

Artist stores a `Map<string, { mesh: Mesh; texture?: DynamicTexture }>` for volumetric entities — same pattern as how `cloudMesh` and `boxMesh` are tracked.

### Overlay Implementations

**`IsosurfaceOverlay`** — `core/src/overlays/isosurface_overlay.ts`

Implements `Overlay`. Does NOT own geometry computation — that lives in `Artist`. Acts as lifecycle container and param store.

```typescript
class IsosurfaceOverlay implements Overlay {
  readonly id: string;
  readonly type = "isosurface";
  visible: boolean;
  props: IsosurfaceProps;

  constructor(overlayId: string, props: IsosurfaceProps)
  // artist.drawIsosurface() is called by DrawIsosurfaceCommand, not here
  dispose(): void  // calls artist.disposeIsosurface(this.id)
}
```

**`SliceOverlay`** — `core/src/overlays/slice_overlay.ts`

Same pattern: lifecycle container for SliceProps. `Artist.drawSlice()` owns the geometry.

### Algorithm Layer

Three pure TypeScript modules with no BabylonJS dependencies — testable in isolation:

**`core/src/algo/marching_cubes.ts`**
- Input: `Float32Array data`, `[Nx,Ny,Nz] shape`, `Float32Array cell[9]` (column-major), `Float32Array origin[3]`, `number isovalue`, `"general"|"periodic" gridType`
- Output: `{ positions: Float32Array, indices: Uint32Array, normals: Float32Array }`
- Algorithm: standard MC lookup table on structured grid; vertices transformed to world coords using column-vector convention; periodic grid wraps boundary edges to avoid seams

**`core/src/algo/field_sampler.ts`**
- `sampleOnPlane(data, shape, cell, origin, normal, position, resolution): Float32Array` — trilinear interpolation; periodic wrap if periodic
- `sampleAtPoint(data, shape, cell, origin, worldPos): number` — single-point trilinear lookup
- `fractionalToWorld(frac, cell, origin): [number,number,number]`
- `worldToFractional(world, cell, origin): [number,number,number]`

**`core/src/algo/contour.ts`**
- Input: 2D Float32Array slice data, contour levels `number[]`
- Output: `{ lines: Float32Array[] }` — one polyline per level in 2D slice coordinates
- Algorithm: marching squares

**`core/src/algo/field_stats.ts`**
- `computeFieldStats(data: Float32Array): VolumetricFieldStats` — single-pass min/max/mean/std + percentile buckets

### File Parsers — Rust in molrs-core, WASM bindings in molrs-wasm

All format parsing is implemented in Rust (`molrs-core/src/io/`). WASM bindings follow the same `Reader` pattern as `XYZReader`, `PDBReader`, etc. in `molrs-wasm/src/io/reader.rs`. TypeScript calls the WASM Reader and receives a `Frame` with atoms + grids already populated.

**Rust parsers** (molrs-core):

```
molrs-core/src/io/chgcar.rs  — exists; reads VASP CHGCAR/LOCPOT/ELFCAR
                               Frame grids["chgcar"]: arrays "total" (+ "diff" if ISPIN=2)
molrs-core/src/io/cube.rs    — new; reads Gaussian Cube (.cube/.cub)
                               Frame grids["density"]: array "rho"
                               Frame blocks["atoms"]: element, x, y, z
molrs-core/src/io/xsf.rs     — new; reads XCrySDen XSF DATAGRID_3D block
                               Frame grids["field"]: array "data"
                               Frame blocks["atoms"]: element, x, y, z (if present)
```

All parsers normalize to the coordinate contract (column-major cell, C row-major axis order, origin at voxel 0,0,0).

**WASM reader bindings** (`molrs-wasm/src/io/reader.rs`, added alongside existing readers):

```typescript
// TypeScript usage (via WASM):
const reader = new CubeReader(fileContent);   // single-frame: len() === 1
const frame  = reader.read(0);                // → Frame | undefined
// frame.gridNames()  → ["density"]
// frame.getGrid("density").arrayNames()  → ["rho"]
// frame.getBlock("atoms")  → Block with element/x/y/z

const reader = new CHGCARReader(fileContent); // single-frame
const frame  = reader.read(0);
// frame.gridNames()  → ["chgcar"]
// frame.getGrid("chgcar").arrayNames()  → ["total"] or ["total","diff"]

const reader = new XSFReader(fileContent);    // may be multi-frame (AXSF)
const frame  = reader.read(0);
// frame.gridNames()  → ["field"]
```

WASM class declarations added to `core/src/molrs-field.d.ts`.

### App Public API Extensions (`core/src/app.ts`)

```typescript
// New method — invokes WASM Reader, extracts grids from returned Frame,
// merges into current frame via frame.insertGrid(), registers in SceneIndex
async loadVolumetricField(
  content: string,
  format: "cube" | "chgcar" | "locpot" | "elfcar" | "xsf"
): Promise<{ gridName: string; arrayNames: string[] }>
```

Internally: `new CubeReader(content).read(0)` → returned Frame → `currentFrame.insertGrid(gridName, grid)`. If the returned Frame also has atoms and no atoms are loaded yet, atoms are merged too.

### UI Components

**`page/src/ui/modes/view/VolumetricPanel.tsx`** (new)

Receives `app: MolvisApp`. Displays:
- Grid list (name, array names, stats min/max) with load button
- For each loaded grid: visibility toggle per array + "Add Isosurface" + "Add Slice" buttons
- Isosurface controls: isovalue slider (log/linear), dual toggle, color pickers, opacity
- Slice controls: normal picker (X/Y/Z presets + custom), position slider, colormap selector, range inputs, contour toggle

**`page/src/ui/modes/view/ViewPanel.tsx`** (extend)

Add third tab "Volumetric" alongside existing "Pipeline" and "Render" tabs.

**`page/src/hooks/useVolumetricState.ts`** (new)

```typescript
function useVolumetricState(app: MolvisApp | null): {
  grids: Array<{ gridName: string; arrayNames: string[]; meta: GridMeta }>;
  overlays: Array<IsosurfaceOverlay | SliceOverlay>;
}
```

Subscribes to `app.events` `grid-loaded`, `overlay-added`, `overlay-removed`, `overlay-changed`.

---

## Tasks

Following MolVis standard order: Data Model → Core Logic → Commands → Mode Integration → UI → Tests → Docs

### M1 — Single isosurface from Gaussian Cube

- [ ] **WASM declarations**: add `Grid` class to `core/src/molrs-field.d.ts` — acceptance: TypeScript can call `new Grid(...)`, `grid.insertArray()`, `grid.getArray()`, `frame.insertGrid()`, `frame.getGrid()`
- [ ] **Coordinate contract doc**: `docs/specs/volumetric-field-visualization/coordinates.md` — acceptance: no ambiguity, documents voxel_position formula, axis ordering, column-major cell convention
- [ ] **`computeFieldStats()`** — `core/src/algo/field_stats.ts` — acceptance: correct min/max/mean/std/percentiles on known test data
- [ ] **`core/src/algo/marching_cubes.ts`** — structured-grid MC with column-vector cell transform — acceptance: unit test with 4³ sphere field produces closed mesh, no NaN
- [ ] **`core/src/io/cube_loader.ts`** — `parseCubeFile()` → `ParsedVolumetricResult` — acceptance: parses H₂O cube, atom positions match reference, grid inserted into Frame correctly
- [ ] **`IsosurfaceProps`** in `core/src/overlays/types.ts` — acceptance: interface compiles
- [ ] **`IsosurfaceOverlay`** — `core/src/overlays/isosurface_overlay.ts` — acceptance: lifecycle container only (no MC inline), `dispose()` calls `artist.disposeIsosurface()`
- [ ] **`Artist.drawIsosurface()` + `Artist.updateIsosurface()` + `Artist.disposeIsosurface()`** — `core/src/artist.ts` — acceptance: mesh visible in BabylonJS scene, disposes cleanly
- [ ] **`SceneIndex.registerGrid()` + `SceneIndex.unregisterGrid()`** — `core/src/scene_index.ts` — acceptance: GridMeta stored and retrievable
- [ ] **`DrawIsosurfaceCommand`, `UpdateIsosurfaceCommand`, `RemoveFieldLayerCommand`, `LoadVolumetricFieldCommand`** — `core/src/commands/volumetric.ts` — acceptance: do/undo symmetry tests pass, UpdateIsosurfaceCommand never calls registerGrid
- [ ] **`app.loadVolumetricField()`** — `core/src/app.ts` — acceptance: callable, returns gridName/arrayNames, Grid appears in `frame.gridNames()`
- [ ] **`grid-loaded` event** in `core/src/events.ts` — acceptance: fires on load/remove
- [ ] **`VolumetricPanel.tsx` (M1 subset)**: grid list + load button + isovalue slider — acceptance: slider updates isosurface in viewport
- [ ] **Add "Volumetric" tab to `ViewPanel.tsx`** — acceptance: tab visible, renders panel
- [ ] **M1 unit tests** — `core/tests/volumetric_stats.test.ts`, `core/tests/marching_cubes.test.ts`, `core/tests/cube_loader.test.ts` — acceptance: all pass

### M2 — Slice + Periodic Grid + Dual Isosurface + VASP

- [ ] **`core/src/algo/field_sampler.ts`** — trilinear interpolation + periodic wrap — acceptance: sampling on axis-aligned planes matches direct indexing
- [ ] **`SliceProps`** in `core/src/overlays/types.ts`
- [ ] **`SliceOverlay`** — `core/src/overlays/slice_overlay.ts` — acceptance: lifecycle container, `dispose()` calls artist
- [ ] **`Artist.drawSlice()` + `Artist.updateSlice()` + `Artist.disposeSlice()`** — acceptance: colored plane visible, DynamicTexture updates on position change
- [ ] **`DrawSliceCommand`, `UpdateSliceCommand`** — `core/src/commands/volumetric.ts` — acceptance: do/undo symmetry
- [ ] **Periodic grid expansion** — `expandPeriodic(grid: Grid): Grid` — acceptance: expanded grid has `dim[i]+1`, boundary values equal index-0 values
- [ ] **`core/src/io/vasp_volumetric_loader.ts`** — CHGCAR + LOCPOT — acceptance: CHGCAR density values normalized by volume match VESTA reference
- [ ] **Non-orthogonal cell support in marching cubes** — acceptance: triclinic cell test produces correct vertex world positions
- [ ] **Dual isosurface (±)** — `Artist.drawIsosurface()` creates second mesh for negative surface when `showNegative === true`
- [ ] **Slice controls in `VolumetricPanel.tsx`**: normal presets, position slider, colormap selector, range
- [ ] **M2 unit tests** — `core/tests/field_sampler.test.ts`, `core/tests/vasp_loader.test.ts`

### M3 — Contours + Multi-field + XSF + Scene State

- [ ] **`core/src/algo/contour.ts`** — marching squares on 2D slice — acceptance: contour at known level on linear-gradient field produces straight line
- [ ] **`ContourOverlay`** — `core/src/overlays/contour_overlay.ts` — acceptance: lines rendered on slice plane, update on level change
- [ ] **`core/src/io/xsf_loader.ts`** — XSF `DATAGRID_3D` block — acceptance: XSF ELF field loads correctly
- [ ] **Multi-field UI**: grid list with independent controls per grid/array
- [ ] **Scene state serialization**: volumetric overlay params (gridName, arrayName, IsosurfaceProps/SliceProps) in `app.saveState()` / `app.loadState()`
- [ ] **VSCode extension file associations**: `.cube`, `.xsf`, CHGCAR/LOCPOT/ELFCAR
- [ ] **M3 unit tests** — `core/tests/contour.test.ts`, `core/tests/xsf_loader.test.ts`
- [ ] **Tutorial examples**: four tutorial files in `docs/tutorials/volumetric/`

---

## Test Criteria

### Unit Tests (`core/tests/`)

**Statistics**:
- [ ] `computeFieldStats(allOnes)`: `min === 1`, `max === 1`, `mean === 1`, `std === 0`
- [ ] Periodic field expansion: `expandPeriodic(grid)` produces `dim[i]+1` for each axis, boundary values equal index-0 values

**Parsers** (Rust tests in `molrs-core/tests/`):
- [ ] `CubeReader::read(h2o_cube)`: `frame.get_grid("density")?.dim` matches reference, atom count matches, origin matches
- [ ] `CHGCARReader::read(chgcar)`: density at voxel (0,0,0) matches reference; spin array present for ISPIN=2
- [ ] `XSFReader::read(xsf_elf)`: field loads without error, `grid.pbc == [true,true,true]`
- [ ] All parsers: coordinate contract respected (column-major cell, C row-major axis order)

**Algorithms**:
- [ ] `marchingCubes(sphereField, isovalue)`: closed surface, vertex positions within sphere radius ± tolerance
- [ ] `marchingCubes(field, isovalue, triclinicCell)`: vertex world positions satisfy `world = cell * frac + origin` (column convention)
- [ ] `sampleOnPlane(data, [0,0,1], 0.5, res)`: XY-plane sample of linear-gradient field matches analytic values
- [ ] `sampleAtPoint(data, worldPos)`: trilinear interpolation at cell center equals mean of 8 corners
- [ ] `sampleOnPlane` with periodic wrap: sampling at frac > 1 wraps correctly

**Commands**:
- [ ] `DrawIsosurfaceCommand.do()` → `undo()`: overlay absent from `overlayManager.list()` after undo
- [ ] `UpdateIsosurfaceCommand.do()` → `undo()`: isovalue restored to pre-update value
- [ ] `UpdateIsosurfaceCommand` does NOT call `sceneIndex.registerGrid()` (mirrors UpdateFrameCommand invariant)
- [ ] `LoadVolumetricFieldCommand.do()` → `undo()`: `frame.hasGrid(gridName) === false` after undo
- [ ] `RemoveFieldLayerCommand.do()` → `undo()`: overlay recreated after undo

**Overlays**:
- [ ] `IsosurfaceOverlay.dispose()`: `artist.disposeIsosurface()` called, mesh removed from scene
- [ ] `SliceOverlay.dispose()`: mesh + DynamicTexture both disposed

### Integration Tests

- [ ] Full flow: load cube file → `DrawIsosurfaceCommand` → isosurface visible in scene
- [ ] Dual isosurface: `showNegative: true` → both meshes visible simultaneously
- [ ] Slice + contour: `DrawSliceCommand` → `showContours: true` → contour lines on slice plane
- [ ] AIMD simulation: 3-frame trajectory, each frame has its own grid → seeking frames updates isosurface

---

## Risks & Open Questions

- **Risk**: Marching cubes on 256³ grid blocks the main thread (≈2M iterations per isovalue) → **Mitigation**: `Artist.drawIsosurface()` must be async; use `setTimeout`-chunked execution from M1; plan Web Worker migration for M2
- **Risk**: `frame.getGrid(name)` returns a clone — for 256³ grids this is a full data copy → **Mitigation**: parsers call `grid.getArray(arrayName).toCopy()` once at parse time and pass `Float32Array` to algorithms; algorithms never call `getGrid()` in hot loops
- **Risk**: Non-orthogonal cell vertex transform introduces floating-point drift in seam detection → **Mitigation**: use epsilon tolerance in seam checking; add test with known triclinic cell
- **Risk**: VASP CHGCAR contains spin-up + spin-down as two grids packed in the same file → **Mitigation**: parser returns both arrays in same `Grid` under names `"chg"` and `"spin"`; UI exposes per-array selection
- **Risk**: `DynamicTexture` update on every slice drag causes GPU stalls → **Mitigation**: debounce `artist.updateSlice()` to 60ms; LOD sampling during drag, full resolution on release
- **Risk**: `DrawIsosurfaceCommand.undo()` → `redo()` must reconstruct geometry — if Artist doesn't store mesh params, redo breaks → **Mitigation**: `DrawIsosurfaceCommand` stores complete `IsosurfaceProps` + gridName; `do()` is idempotent (new overlayId each time)
- **Open question**: For AIMD trajectories, should isosurface automatically re-render when the frame changes (density changes per frame)? → **Proposed**: Yes — `frame-change` event triggers `UpdateIsosurfaceCommand` with same props but reads new frame's grid. Must be opt-in to avoid stalling on static DFT frames with no grid.
- **Open question**: Should `app.loadVolumetricField()` also insert atom data from `.cube` files into the current frame? → **Proposed default**: yes for `.cube` if no atoms are currently loaded; no-op if atoms exist. VASP/XSF: structure comes from POSCAR/CONTCAR, not the volumetric file.
