# Package architecture (naming lock)

Decided 2026-07-30. Updated 2026-08-05: **umbrella is the repo root**, not a
separate workspace package.

## Topology

```
                    core/  (@molcrafts/molvis-core)
                    · sole import face for @molcrafts/molrs (WASM once)
                    · pure data: elements / radii / normalize
                    · framework-free shared Web Components
                    · published as a *transitive* dep of stage/sketch
                    · not a product install
                              │
              ┌───────────────┴───────────────┐
              v                               v
   sketch/                         stage/
   @molcrafts/molvis-sketch        @molcrafts/molvis-stage
   2D Canvas sketcher              3D Babylon engine
   React-free                      React-free
              \                               /
               \                             /
                v                           v
   repo root  @molcrafts/molvis  (thin re-export only — src/*.js)
                │
                v
         page/  (+ vsc-ext, python hosts)
```

## npm / directory matrix

| Role | Directory | Package name | Publish? |
|------|-----------|--------------|----------|
| Shared molrs gateway | `core/` | `@molcrafts/molvis-core` | **Yes** (transitive) |
| 2D sketcher | `sketch/` | `@molcrafts/molvis-sketch` | **Yes** |
| 3D engine | `stage/` | `@molcrafts/molvis-stage` | **Yes** |
| Umbrella (both engines) | **repo root** | `@molcrafts/molvis` | **Yes** — `src/` re-exports only; **not** a workspace member |
| Product UI | `page/` | `page` (private) | **No** |
| VS Code host | `vsc-ext/` | Marketplace extension | **Yes** (vsce) |
| Python host | `python/` | `molcrafts-molvis` | **Yes** (PyPI) |

### Hard rules

1. **Only `core` may import `@molcrafts/molrs`.** sketch and stage import `@molcrafts/molvis-core`.
2. **sketch ↛ stage, stage ↛ sketch.** Engines are peers.
3. **React / shadcn only in `page` (and hosts that mount page).**
4. **Umbrella lives at the monorepo root** — `package.json` name `@molcrafts/molvis`, thin `src/` re-exports, `files: ["src", …]`. Do **not** reintroduce a separate `umbrella/` workspace.
5. Root **runtime** `dependencies` are only stage + sketch. Monorepo tooling (biome, rstest, molplot, vega, …) stays in root `devDependencies` so the published umbrella tarball stays lean.
