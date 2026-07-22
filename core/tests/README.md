# core/tests — unit + integration layout

## Lanes

| Lane | Path | Purpose |
|------|------|---------|
| Unit | `tests/**/*.test.ts` (except `integration/`) | Single-module, fakes OK; path mirrors `src/` |
| Integration | `tests/integration/**` | Only multi-module façades that need core's rstest root |
| Public API goldens | repo-root `regressions/` | Hard-coded goldens (`npm run test:regressions`) |

Helpers (not cases): `setup_wasm.ts`, `io/cache/opfs_test_helpers.ts`.

Integration currently holds only `headless_renderer` + `world_reset_camera`.
Everything else was split into unit mirrors or regressions.

## Mirror status (`src/foo/bar.ts` → `tests/foo/bar.test.ts`)

| Status | Area |
|--------|------|
| ✅ | `camera/`, `commands/`, `modifiers/` (PascalCase), `pipeline/` |
| ✅ | `io/cache/`, `io/sources/`, `io/atom_coords`, `io/formats`, `io/reader.lazy` |
| ✅ | `algo/`, `transport/` (ws_bridge, rpc, trajectory_worker) |
| ✅ | `system/*` modules, `selection/`, `artist/` (+ ribbon), `analysis/` |
| ✅ | `overlays/`, `export/`, `utils/`, `mode/`, `ui/menus/` |
| ⬜ flat (matches top-level `src/*.ts` or multi-unit) | see below |

### Intentionally flat (top-level source or multi-unit)

```
axis_helper, data_inspector, element, events, frame_render_scheduler,
selection_manager, selection_reconciler, selection_context, system,
atom_source_element_cache, build_frame_from_scene, impostor_*, 
rpc_style_scope, theme_example_xyz
```

When adding tests for a nested module, place them under the mirror path.
Multi-module stories → `integration/`. Public goldens → `regressions/`.

Runner: `@rstest/core` (Chromium + WASM). Include globs are recursive.
