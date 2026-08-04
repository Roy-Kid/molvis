# Package architecture (naming lock)

Decided 2026-07-30. Supersedes informal “runtime / scene / chem” naming in chat.

## Topology

```
                    core/  (@molcrafts/molvis-core — PRIVATE workspace)
                    · sole import face for @molcrafts/molrs (WASM once)
                    · thin re-exports + optional helpers
                    · pure data: elements / radii / normalize
                    · explicit, framework-free shared Web Components
                    · sideEffects only on molrs entry; subpaths tree-shakeable
                    · NOT published to npm as a consumer-facing product
                              │
              ┌───────────────┴───────────────┐
              v                               v
   sketch/                         stage/   (today: mostly still under core/)
   @molcrafts/molvis-sketch        @molcrafts/molvis-stage
   2D Canvas sketcher              3D Babylon engine
   React-free                      React-free
              \                               /
               \                             /
                v                           v
                     page/  (+ vsc-ext, python hosts)
                     React + shadcn product shell
                              │
                              v
              @molcrafts/molvis  (published umbrella: 2D + 3D)
```

## npm / directory matrix

| Role | Directory (target) | Package name | Publish? |
|------|--------------------|--------------|----------|
| Shared molrs gateway + pure/browser primitives | `core/` | `@molcrafts/molvis-core` (workspace; private product surface) | **No** (or private / not in public catalog) |
| 2D sketcher | `sketch/` | `@molcrafts/molvis-sketch` | **Yes** |
| 3D engine | `stage/` (migrate from today’s `core/` engine code) | `@molcrafts/molvis-stage` | **Yes** |
| Umbrella (2D+3D convenience) | root or `packages/molvis` | `@molcrafts/molvis` | **Yes** — re-exports sketch + stage (and docs entry) |
| Product UI | `page/` | not a public library | ships inside python / vsc-ext / standalone |

### Hard rules

1. **Only `core` may import `@molcrafts/molrs`.** sketch and stage import `@molcrafts/molvis-core` (or subpaths). CI greps the ban.
2. **sketch ↛ stage, stage ↛ sketch.** Engines are peers.
3. **React / shadcn only in `page` (and hosts that mount page).** core / sketch / stage are React-free.
4. **core is tree-shakeable:**
   - `sideEffects` limited to the molrs/wasm entry
   - `@molcrafts/molvis-core/elements` (or similar) has **no** molrs import
   - unbundled build so the app bundler dedupes one wasm graph
   - framework-free Web Components live behind explicit subpaths and explicit,
     idempotent `define*` calls; importing the default barrel never registers DOM
5. **Umbrella `@molcrafts/molvis`** is for apps that want both engines without choosing; it must not force double-wasm (depends on core once, re-exports sketch + stage).

## Rename map (from today’s tree)

| Today | Target |
|-------|--------|
| `core/` 3D engine + elements + molrs use | split: engine → `stage/`; elements + molrs face → stay/become true `core/` |
| `@molcrafts/molvis-core` as public 3D package | becomes **private shared core**; public 3D = `@molcrafts/molvis-stage` |
| `@molvis/core` source alias | → `@molvis/stage` (engine) + `@molvis/core` (shared only) |
| sketch (unchanged product name) | `@molcrafts/molvis-sketch` |
| (new) umbrella | `@molcrafts/molvis` |

### Source aliases (dev)

```
@molvis/core   → core/src     // shared only after split
@molvis/sketch → sketch/src
@molvis/stage  → stage/src    // 3D engine
```

Dev aliases: `@molvis/stage` → stage; `@molcrafts/molvis-core` → shared core only.
No backward-compat alias maps the old public engine name to stage.

## core package surface (shared)

Exports:

```
@molcrafts/molvis-core          # barrel (careful sideEffects)
@molcrafts/molvis-core/molrs    # Frame, Block, generate3D, parseSMILES, … (wasm)
@molcrafts/molvis-core/elements # PeriodicTable, normalizeElement, palettes (no wasm)
@molcrafts/molvis-core/element-picker # native custom element + explicit define()
@molcrafts/molvis-core/opfs         # /molvis/v1 namespace, blob bucket, fingerprint,
                                    #   usage + clear (browser-origin storage)
@molcrafts/molvis-core/platform     # isMac / isCtrlOrMeta / getModifierName
@molcrafts/molvis-core/save-file    # saveBlob: picker with anchor fallback
@molcrafts/molvis-core/image-crop   # alpha-trim, crop, re-encode a canvas
```

**Browser infrastructure belongs in core.** Anything that talks to a browser
API but knows nothing about 2D or 3D goes here, because `sketch ↛ stage` makes
core the only place both engines can reach. Before this rule was applied the
two engines had already diverged: sketch hand-rolled `metaKey || ctrlKey`
(wrong on macOS, where Ctrl is the secondary-click modifier) while stage had a
correct platform check, and each had its own file-save mechanism — stage threw
where the File System Access API is missing, sketch never offered a picker at
all.

Engine-specific *contents* stay with their engine even when they sit in a core
bucket: stage owns the `.molidx` trajectory index sidecar and its codec; core
owns only the namespace, the byte bucket, and the sweep helpers.

Adding a core subpath means four edits — `core/package.json` exports, plus the
externals list **and** the dts alias map in both `stage/rslib.config.ts` and
`sketch/rslib.config.ts`. Miss the externals entry and the engine bundle
inlines a second copy of core instead of sharing one.

Not in core: Babylon, SketchBoard, React, pipeline, RPC. Shared UI primitives
may live here only as framework-free Web Components backed by core-owned data;
sketch, stage, and page consume them instead of reimplementing them.

## stage package surface (3D)

Public name: `@molcrafts/molvis-stage`  
Contents: today’s engine (`MolvisApp`, pipeline, artist, transport, …).  
Depends on: `@molcrafts/molvis-core` only (for molrs + elements).  
Keeps subpaths as needed: `./io`, `./io/formats`, web component entry (rename carefully; today’s `./elements` CDN entry is the **viewer bundle**, not the periodic table — avoid colliding names).

## sketch package surface (2D)

Public name: `@molcrafts/molvis-sketch` (already).  
Depends on: `@molcrafts/molvis-core` only (drop direct `@molcrafts/molrs`).

## umbrella `@molcrafts/molvis`

- Depends on sketch + stage (+ core once transitively).
- Re-exports primary public APIs for “install one package, get both”.
- Optional: thin `mount` facade if product needs it; otherwise pure re-export.

## Migration phases

1. **Carve true `core`** — molrs single face + elements; forbid other packages from importing `@molcrafts/molrs`.
2. **Point sketch at core** — remove sketch’s direct molrs dep; verify one wasm in page build.
3. **Rename engine → stage** — move 3D sources to `stage/`, package `@molcrafts/molvis-stage`; deprecate public identity of “core = 3D”.
4. **Add umbrella `@molcrafts/molvis`** — re-exports.
5. **page / vsc-ext / python** — aliases and docs; call out the breaking rename for consumers of `@molcrafts/molvis-core` as 3D in the PR / GitHub Release (no hand-written CHANGELOG).

## Explicitly rejected names

- shared as `molvis-chem` / `runtime` / `foundation` — rejected; **shared = core**.
- 3D as `scene` — rejected; **3D = stage**.
- Publishing shared core as the main product — rejected; **product engines are sketch + stage + umbrella**.
