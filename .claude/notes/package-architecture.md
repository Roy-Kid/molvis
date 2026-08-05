# Package architecture (naming lock)

Decided 2026-07-30. Updated 2026-08-05: **no umbrella package**.

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
                     page/  (+ vsc-ext, python hosts)
                     React + shadcn product shell
```

## npm / directory matrix

| Role | Directory | Package name | Publish? |
|------|-----------|--------------|----------|
| Shared molrs gateway + pure/browser primitives | `core/` | `@molcrafts/molvis-core` | **Yes** (transitive only) |
| 2D sketcher | `sketch/` | `@molcrafts/molvis-sketch` | **Yes** |
| 3D engine | `stage/` | `@molcrafts/molvis-stage` | **Yes** |
| Product UI | `page/` | `page` (private) | **No** — ships inside Python / VS Code |
| VS Code host | `vsc-ext/` | Marketplace extension | **Yes** (vsce) |
| Python host | `python/` | `molcrafts-molvis` | **Yes** (PyPI) |

### Hard rules

1. **Only `core` may import `@molcrafts/molrs`.** sketch and stage import `@molcrafts/molvis-core` (or subpaths).
2. **sketch ↛ stage, stage ↛ sketch.** Engines are peers.
3. **React / shadcn only in `page` (and hosts that mount page).** core / sketch / stage are React-free.
4. **core is tree-shakeable** — unbundled build; sideEffects limited to the molrs entry.
5. **No umbrella.** Install `@molcrafts/molvis-stage` and/or `@molcrafts/molvis-sketch` explicitly.

### Source aliases (dev)

```
@molvis/core   → core/src
@molvis/sketch → sketch/src
@molvis/stage  → stage/src
```
