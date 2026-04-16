# Tasks: volumetric-field-visualization

See `design.md` for full spec. This file is the flat task list for implementation tracking.

## Prerequisite — WASM Grid Bindings (Complete)

- [x] `molrs-wasm/src/core/grid.rs` — `Grid` WASM wrapper with `insertArray`/`getArray`/`arrayNames`/`dim`/`origin`/`cell`/`pbc`
- [x] `molrs-wasm/src/core/frame.rs` — `insertGrid`/`getGrid`/`gridNames`/`hasGrid`/`removeGrid` on `Frame`
- [x] `molrs-wasm/src/core/mod.rs` — `pub mod grid; pub use grid::Grid;`
- [x] `core/src/molrs-field.d.ts` — add `Grid` TypeScript class declaration

## M1 — Single Isosurface from Gaussian Cube

- [ ] Coordinate convention doc (`docs/specs/volumetric-field-visualization/coordinates.md`)
- [ ] `computeFieldStats()` utility (`core/src/algo/field_stats.ts`)
- [ ] `core/src/algo/marching_cubes.ts` — structured-grid MC with column-vector cell transform
- [ ] `molrs-core/src/io/cube.rs` — Gaussian Cube parser → Frame with grids["density"]/"rho" + atoms
- [ ] `molrs-wasm/src/io/reader.rs` — `CubeReader` WASM binding (`new(content)`, `read(step)`, `len()`)
- [ ] `core/src/molrs-field.d.ts` — add `CubeReader` TypeScript declaration
- [ ] `IsosurfaceProps` in `core/src/overlays/types.ts`
- [ ] `IsosurfaceOverlay` in `core/src/overlays/isosurface_overlay.ts` (lifecycle container only)
- [ ] `Artist.drawIsosurface()`, `Artist.updateIsosurface()`, `Artist.disposeIsosurface()` in `core/src/artist.ts`
- [ ] `SceneIndex.registerGrid()`, `SceneIndex.unregisterGrid()` in `core/src/scene_index.ts`
- [ ] `LoadVolumetricFieldCommand`, `DrawIsosurfaceCommand`, `UpdateIsosurfaceCommand`, `RemoveFieldLayerCommand` in `core/src/commands/volumetric.ts`
- [ ] `app.loadVolumetricField()` in `core/src/app.ts`
- [ ] `grid-loaded` event in `core/src/events.ts`
- [ ] `page/src/ui/modes/view/VolumetricPanel.tsx` (M1 subset: grid list + load + isovalue slider)
- [ ] "Volumetric" tab in `page/src/ui/modes/view/ViewPanel.tsx`
- [ ] `page/src/hooks/useVolumetricState.ts`
- [ ] Tests: `core/tests/volumetric_stats.test.ts`, `core/tests/marching_cubes.test.ts`; molrs-core: `tests/test_io/test_cube.rs`

## M2 — Slice + Periodic Grid + Dual Isosurface + VASP

- [ ] `core/src/algo/field_sampler.ts` — trilinear interp + periodic wrap
- [ ] `SliceProps` in `core/src/overlays/types.ts`
- [ ] `SliceOverlay` in `core/src/overlays/slice_overlay.ts` (lifecycle container)
- [ ] `Artist.drawSlice()`, `Artist.updateSlice()`, `Artist.disposeSlice()` in `core/src/artist.ts`
- [ ] `DrawSliceCommand`, `UpdateSliceCommand` in `core/src/commands/volumetric.ts`
- [ ] `expandPeriodic(grid): Grid` utility
- [ ] `molrs-wasm/src/io/reader.rs` — `CHGCARReader` WASM binding (chgcar.rs already in molrs-core)
- [ ] `core/src/molrs-field.d.ts` — add `CHGCARReader` TypeScript declaration
- [ ] Non-orthogonal cell support in `marching_cubes.ts`
- [ ] Dual isosurface (±) in `Artist.drawIsosurface()`
- [ ] Slice controls in `VolumetricPanel.tsx`
- [ ] Tests: `core/tests/field_sampler.test.ts`; molrs-core: `tests/test_io/test_chgcar.rs` (extend)

## M3 — Contours + Multi-field + XSF + Scene State

- [ ] `core/src/algo/contour.ts` — marching squares
- [ ] `ContourOverlay` in `core/src/overlays/contour_overlay.ts`
- [ ] `molrs-core/src/io/xsf.rs` — XSF DATAGRID_3D parser
- [ ] `molrs-wasm/src/io/reader.rs` — `XSFReader` WASM binding
- [ ] `core/src/molrs-field.d.ts` — add `XSFReader` TypeScript declaration
- [ ] Multi-field UI in `VolumetricPanel.tsx`
- [ ] Scene state serialization for volumetric overlays + grids in `app.saveState()` / `app.loadState()`
- [ ] VSCode extension file associations (`.cube`, `.xsf`, CHGCAR/LOCPOT/ELFCAR)
- [ ] Tests: `core/tests/contour.test.ts`; molrs-core: `tests/test_io/test_xsf.rs`
- [ ] Tutorial docs: `docs/tutorials/volumetric/` (4 examples)
