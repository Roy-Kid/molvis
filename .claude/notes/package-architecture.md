# Package architecture

Canonical monorepo layout for MolVis **0.2.0**.

## Topology

```
core/     @molcrafts/molvis-core     shared molrs gateway + pure/browser primitives
  │                                  (published; transitive only — not a product install)
  ├─→ stage/   @molcrafts/molvis-stage    3D engine (Babylon, pipeline, RPC)
  └─→ sketch/  @molcrafts/molvis-sketch   2D canvas sketcher
        │
        ▼
  repo root   @molcrafts/molvis      thin re-exports (src/*.js) — not a workspace member
        │
        ▼
  page/       (private)              React 19 product shell
  vsc-ext/    molvis (private)       VS Code extension host
  python/     molcrafts-molvis       PyPI driver + shipped page bundle
```

## Rules

1. **Only `core` imports `@molcrafts/molrs`.** stage/sketch import `@molcrafts/molvis-core` (and subpaths).
2. **sketch ↛ stage, stage ↛ sketch.** Peers only.
3. **React only in `page` (and hosts that mount page).** Engines are React-free.
4. **Hosts consume engines as packages**, not monorepo source paths:
   - Import `@molcrafts/molvis-stage` / `@molcrafts/molvis-sketch` / `@molcrafts/molvis-core/*`
   - Resolve via workspace `node_modules` → package `exports` → `dist/`
   - **Never** `../stage/src/...` or `../core/src/...` from hosts
5. **Umbrella is the repo root** (`@molcrafts/molvis`), not a separate workspace package.
6. **Build order for hosts:** `core → stage → sketch → page | vsc-ext`.

## Publish surface

| Package | How published |
|---------|----------------|
| `@molcrafts/molvis-core` | npm (tag workflow) |
| `@molcrafts/molvis-stage` | npm |
| `@molcrafts/molvis-sketch` | npm |
| `@molcrafts/molvis` | npm (root `npm publish`) |
| `molcrafts-molvis` | PyPI |
| VS Code `molvis` | Marketplace (vsce) |

## Not in tree

- No `umbrella/` workspace
- No repo-root `e2e/`, `regressions/`, or engine `examples/` demos
- No host path aliases into engine `src/`
