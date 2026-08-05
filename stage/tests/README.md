# stage/tests — unit only

## Rules (CLAUDE.md)

- **Unit only** under `tests/`. Path mirrors `src/` (`src/foo/bar.ts` →
  `tests/foo/bar.test.ts`). Types mirror (`FooClass` → `TestFooClass` / file
  name). Single concern per test — **no e2e, multi-module façades, or full
  app boots** here.
- **Public-API goldens** → repo-root `regressions/` (`npm run test:regressions`).
- **Page/app E2E** (real Chromium driving a built URL) → repo-root `e2e/` with
  `@rstest/playwright` (`npm run test:e2e`). Not mixed into this tree.

Helpers (not cases): `setup_wasm.ts`, `io/cache/opfs_test_helpers.ts`.

## Runner

`@rstest/core` **browser mode** (`@rstest/browser` + Playwright Chromium) so
WASM and DOM APIs work. This is still unit/component testing — the test body
runs *inside* the page bundle, not against a deployed app.

| Lane | Path | Runner |
|------|------|--------|
| Unit | `stage/tests/**` | `@rstest/core` + browser mode |
| Goldens | `regressions/` | `@rstest/core` + browser mode |
| E2E | `e2e/**` | `@rstest/playwright` (Node worker + `page.goto`) |

## Mirror status

| Status | Area |
|--------|------|
| ✅ | `camera/`, `commands/`, `modifiers/`, `pipeline/` |
| ✅ | `io/`, `algo/`, `transport/`, `system/*` modules |
| ✅ | `selection/`, `artist/` (+ ribbon), `analysis/` |
| ✅ | `overlays/`, `export/`, `mode/`, `ui/` |
| ⬜ flat (top-level `src/*.ts` or multi-unit helper) | see list below |

### Intentionally flat

```
axis_helper, data_inspector, element, events, frame_render_scheduler,
selection_manager, selection_reconciler, selection_context, system,
atom_source_element_cache, build_frame_from_scene, impostor_*,
rpc_style_scope, app_modifier_toggle (static method only)
```

When adding tests for a nested module, place them under the mirror path.
Do **not** reintroduce `tests/integration/` or boot a full `new MolvisApp`
pipeline here — that belongs in `e2e/` or `regressions/`.
