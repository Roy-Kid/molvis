# molrs-wasm 0.0.8 — WASM Float Precision Audit

**Bump**: `@molcrafts/molrs` → 0.0.8 (verified in `molrs-wasm/pkg/package.json:8`).

**Why this audit**: molrs removed the compile-time `f32 / f64` precision feature switch. In 0.0.8 every float-accepting WASM method requires **`Float64Array`**. Any call site still passing `Float32Array` will either throw or silently coerce through WASM memory. TypeScript does not catch this because WASM bindings accept loosely-typed inputs.

**Methodology**: grep every float-accepting WASM method across `core/`, `page/`, `python/`, `vsc-ext/`; classify each call site.

Legend: `ok` = passes `Float64Array`. `fix` = wrong typed-array, must change. `view` = reads WASM output (returns `Float64Array` in 0.0.8, no caller change needed).

---

## 1. `Block.setColF(key, Float64Array)`

| File:line | Arg source | Status |
|---|---|---|
| `core/src/scene_sync.ts:82-84` | `Float64Array` constructed upstream | ok |
| `core/src/analysis/rdf.ts:200-202` | `Float64Array` | ok |
| `core/src/modifiers/ColorByPropertyModifier.ts:234-236` | `Float64Array` | ok |
| `core/src/modifiers/AssignColorModifier.ts:98-100` | `Float64Array` | ok |
| `core/src/modifiers/WrapPBCModifier.ts:80-82` | `Float64Array` | ok |
| `core/src/modifiers/DeleteSelectedModifier.ts:72` | `Float64Array` | ok |
| `core/src/modifiers/HideHydrogensModifier.ts:143` | `Float64Array` | ok |
| `core/src/modifiers/HideSelectionModifier.ts:68` | `Float64Array` | ok |
| `page/src/lib/rpc/serialization.ts:217,221,251,273` | always coerced: `Float32Array→Float64Array.from(value)`; plain arrays → `Float64Array.from(value)` | ok |
| `python/src/ts/serialization.ts:214,218,248,270` | mirror of page | ok |
| `page/src/hooks/useBootstrapDemo.ts:34,42,50` | literal `new Float64Array([...])` | ok |
| `core/examples/demo_frame.ts:24-26` | `new Float64Array([...])` | ok |
| `core/examples/demo_traj.ts:41-43`, `demo_empty.ts:25-27`, `demo_perf.ts:216-218` | `new Float64Array(...)` | ok |
| `core/tests/*.ts` (atom_buffer, delete_selected, assign_color, dag_pipeline, data_inspector, expression_modifier, hide_modifier, hide_hydrogens, rdf, slice-modifier, transparent_selection, bond_order, overlays, color_by_property) | all `new Float64Array(...)` | ok |

## 2. `Block.setColU32(key, Uint32Array)`

| File:line | Arg source | Status |
|---|---|---|
| `core/src/modifiers/DeleteSelectedModifier.ts:82,131,132,138` | `Uint32Array` | ok |
| `core/src/modifiers/HideHydrogensModifier.ts:103,104,110,178` | `Uint32Array` | ok |
| `core/src/modifiers/HideSelectionModifier.ts:136,137,138` | `Uint32Array` | ok |
| `core/src/scene_sync.ts:104-106` | `Uint32Array` | ok |
| `core/src/reader.ts:85,100,109` | `Uint32Array` (constructed from i32/f64 views) | ok |
| `page/src/lib/rpc/serialization.ts:225,235,239,261,270` | always coerced to `Uint32Array` | ok |
| `python/src/ts/serialization.ts:222,232,236,258,267` | mirror | ok |
| `page/src/hooks/useBootstrapDemo.ts:84-97` | `new Uint32Array(...)` | ok |
| `page/src/ui/modes/edit/BuilderTab.tsx:128,132,136` | `new Uint32Array(...)` | ok |
| `core/examples/demo_*.ts` + `core/tests/*.ts` | `new Uint32Array(...)` | ok |

**Note**: `page/src/lib/rpc/serialization.ts:233-236` routes `Int32Array` inputs through `Uint32Array.from(value, Number)`. Signed negative values become garbage (`-1` → `4294967295`). Existing behavior — pre-dates 0.0.8. Out of scope for this bump, but flag for later: if the RPC needs signed integer columns, add a `setColI32` branch. Python mirror has the same shape.

## 3. `Block.setColI32(key, Int32Array)`

| File:line | Arg source | Status |
|---|---|---|
| `core/src/modifiers/DeleteSelectedModifier.ts:92` | `Int32Array` | ok |
| `core/src/modifiers/HideHydrogensModifier.ts:196` | `Int32Array` | ok |

## 4. `Box.cube(size: number, origin: Float64Array, pbc...)`

| File:line | Arg source | Status |
|---|---|---|
| `core/src/reader.ts:153` | `new Float64Array([0,0,0])` | ok |
| `core/tests/rdf.test.ts:25` | `new Float64Array([0,0,0])` | ok |
| `core/examples/demo_frame.ts:34` | `new Float32Array([0,0,0])` | **fix** |

## 5. `Box.ortho(lengths: Float64Array, origin: Float64Array, pbc...)`

| File:line | Arg source | Status |
|---|---|---|
| `core/src/reader.ts:155` | both `Float64Array` | ok |

## 6. `new Box(h: Float64Array, origin: Float64Array, pbc...)`

| File:line | Arg source | Status |
|---|---|---|
| `page/src/lib/rpc/serialization.ts:418` | `Float64Array.from(flattenNumbers(...))` | ok |
| `python/src/ts/serialization.ts:467` | mirror | ok |

## 7. `new Grid(dx, dy, dz, origin: Float64Array, cell: Float64Array, pbc...)`

Only exercised in tests — production code consumes `Grid` via `frame.getGrid()` read-only.

| File:line | Arg source | Status |
|---|---|---|
| `core/tests/marching_cubes.test.ts:67,82,90,95,263` | `ZERO_ORIGIN`, `UNIT_CELL` both `Float64Array` (lines 17-18) | ok |

## 8. `Grid.insertArray(name, Float64Array)`

| File:line | Arg source | Status |
|---|---|---|
| `core/tests/marching_cubes.test.ts:70` | `Float64Array` | ok |
| `core/tests/marching_cubes.test.ts:96` | intentional wrong-size throw test (`new Float64Array(7)`) | ok |
| `core/tests/marching_cubes.test.ts:273` | `raw = sphereField(...)` — runtime `Float64Array` despite wrong TS annotation (see below) | ok at runtime, annotation misleading |

## 9. Misleading type annotations (fix for readability, not correctness)

These don't break 0.0.8 (runtime is correct) but contradict the real value types:

| File:line | Problem | Fix |
|---|---|---|
| `core/tests/marching_cubes.test.ts:4` | doc comment says "WASM Grid → Float32Array → ..." | rewrite to `Float64Array` |
| `core/tests/marching_cubes.test.ts:29,35,42,46,52` | `makeField` / `sphereField` annotated `: Float32Array` but return `new Float64Array(...)` | change return type + param type to `Float64Array` |
| `core/tests/marching_cubes.test.ts:56` | `hasNoInvalid(arr: Float32Array)` called with `Float64Array` inputs | param to `Float32Array \| Float64Array` |
| `core/src/reader.ts:89` | comment "readers may produce f32 or i32" — 0.0.8 has no f32 | rewrite to "f64 or i32" |
| `core/src/reader.ts:94` | variable name `f32` holds a `Float64Array` view | rename to `f64` |

---

## Exclusions — legitimate `Float32Array` uses (NOT WASM-facing)

These arrays feed BabylonJS / WebGL GPU buffers and must stay `Float32Array`. Do NOT touch during a WASM precision sweep:

- `core/src/artist/atom_buffer.ts` — thin-instance matrix/data/color/pick buffers
- `core/src/artist/bond_buffer.ts` — thin-instance buffers + endpoint color helpers
- `core/src/artist/material_spec.ts` — shader uniforms
- `core/src/artist/label_renderer.ts` — label vertex positions
- `core/src/artist/ribbon/ribbon_geometry.ts` — ribbon mesh vertex data
- `core/src/artist/warmup.ts`, `core/src/artist/palette.ts` — LUTs and warmup matrices
- `core/src/picker.ts` — picking color packing
- `core/src/mode/manipulate.ts` — per-atom update matrices / colors
- `core/src/modifiers/VectorFieldModifier.ts` — positions/vectors for GPU lines
- `core/src/analysis/msd.ts:11,59` — `perParticle` statistics exposed to UI

---

## Summary

- **1 production fix**: `core/examples/demo_frame.ts:34` (`Float32Array` → `Float64Array`).
- **5 cosmetic fixes** in `core/tests/marching_cubes.test.ts` and `core/src/reader.ts:89,94` (type annotations / comments / var names that lie about the actual precision).
- Every other WASM-float call site already passes `Float64Array` — no other changes required for 0.0.8.
- Phase 1 (`npm run typecheck` + existing test suites) becomes the final signal. Phase 2/3 new tests ensure the next bump fails fast at the boundary instead of inside a modifier.
