---
status: code-complete
slug: package-split-core-stage
created: 2026-07-30
revised: 2026-07-30
grilled: false
---

# package-split-core-stage

## Summary

Reshape the monorepo so **shared molrs + pure primitives live in `core/`**, the **3D engine moves to `stage/`**, **`sketch/` stays 2D**, and public npm names become **`@molcrafts/molvis-sketch`**, **`@molcrafts/molvis-stage`**, umbrella **`@molcrafts/molvis`**. Shared `@molcrafts/molvis-core` is workspace-private: sole `@molcrafts/molrs` import face, tree-shakeable subpaths, single WASM instance.

## Domain basis

- Molecular data types (`Frame`, `Block`, `generate3D`, …) come from `@molcrafts/molrs` (bundler-target WASM). Multiple direct imports risk **double WASM**.
- Element radii / normalize are pure data already in `system/elements.ts`; 2D and 3D both need them without React.
- Product UI stays React-only in `page/`.

## Design

### Target layout

```
core/     @molcrafts/molvis-core   PRIVATE  molrs face + elements
sketch/   @molcrafts/molvis-sketch YES      2D (deps: core only)
stage/    @molcrafts/molvis-stage  YES      3D (deps: core only; was engine in core/)
page/     product shell            deps stage + sketch (+ core transitively)
umbrella/ @molcrafts/molvis        YES      re-exports sketch + stage
```

### Hard rules

1. Only `core` may import `@molcrafts/molrs` (CI grep).
2. sketch ↛ stage, stage ↛ sketch.
3. React/shadcn only in page (and hosts mounting page).
4. core: `sideEffects` only on molrs entry; `@molcrafts/molvis-core/elements` never imports molrs.
5. page/bundler resolves one physical molrs module.

### core public surface (workspace)

```
@molcrafts/molvis-core           barrel (minimal side effects)
@molcrafts/molvis-core/molrs     Frame, Block, generate3D, parseSMILES, …
@molcrafts/molvis-core/elements  PeriodicTable, normalizeElement, radii, …
```

### stage surface

Today’s engine API under `@molcrafts/molvis-stage` (and dev alias `@molvis/stage`).  
CDN viewer bundle entry renames away from `./elements` if it collides with periodic-table path (prefer `./viewer` or keep staged path documented).

### Reuse

| Candidate | Tag | Decision |
|-----------|-----|----------|
| `core/src/system/elements.ts` | reuse | Move SSOT into `core/src/elements.ts`; stage re-exports for compat |
| `core/src/index.ts` engine | generalize | Becomes stage entry |
| sketch molrs imports | reuse | Switch to `@molcrafts/molvis-core/molrs` |
| page `@molvis/core` alias | generalize | Point at stage; add `@molvis/core` → shared core for elements |

### Migration order

1. Create slim true-`core` package (molrs + elements) **alongside** engine still in old tree, **or** `git mv core stage` then create new core — prefer **mv first** to avoid dual engines.
2. Wire stage + sketch to core; ban direct molrs outside core.
3. Update page / vsc-ext / root scripts / workspaces.
4. Add umbrella `@molcrafts/molvis`.
5. Docs + package-architecture note already locked.

## Files

| Path | Action |
|------|--------|
| `core/` | **Replace**: after mv, new slim package |
| `stage/` | **Add** via `git mv core stage` + rename package |
| `sketch/package.json` | dep core; drop molrs |
| `sketch/src/**` | import from `@molcrafts/molvis-core/molrs` |
| `page/rsbuild.config.ts`, `tsconfig.json` | aliases stage + core |
| `page/src/**` | `@molvis/core` → `@molvis/stage` for engine types |
| `package.json` (root) | workspaces + scripts |
| `umbrella/` or `packages/molvis/` | new umbrella package |
| `.claude/notes/package-architecture.md` | already done; keep in sync |

## Tasks

1. **Write** this spec + acceptance; INDEX entry.
2. **Move** engine tree `core/` → `stage/`; package name `@molcrafts/molvis-stage`.
3. **Create** slim `core/` with `molrs.ts`, `elements.ts`, exports, rslib, tests.
4. **Replace** all non-core `@molcrafts/molrs` imports with `@molcrafts/molvis-core/molrs`.
5. **Replace** stage element SSOT with re-export from core.
6. **Wire** sketch dep + imports + setup_wasm via core.
7. **Wire** page/vsc aliases `@molvis/stage` + `@molvis/core` (shared).
8. **Add** umbrella `@molcrafts/molvis` re-exporting sketch + stage.
9. **Update** root workspaces/scripts; CI ban-grep for direct molrs.
10. **Verify** typecheck + sketch/stage unit tests; page typecheck.

## Testing

- Unit: core elements normalize; core molrs re-export Frame constructible after setup.
- sketch molecule_graph + generate3D path still works via core.
- stage existing smoke subset (or full if time).
- Grep gate: no `@molcrafts/molrs` outside `core/`.

## Out of scope

- React ElementPeriodicTable UI polish (follow-up).
- Publishing to npm registry / version bumps on npm.
- Merging Command / SketchHistory.
- Python API rename.
- Full docs site rewrite (minimal path updates only if build breaks).
