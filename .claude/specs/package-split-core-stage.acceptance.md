# package-split-core-stage — acceptance

## Criteria

| id | type | criterion | verify |
|----|------|-----------|--------|
| A1 | unit | `core` package exports `normalizeElement` / `PeriodicTable` from `./elements` without importing molrs in that module | `tests` in core + file grep |
| A2 | unit | `core` re-exports `Frame`, `Block`, `generate3D` from `./molrs` | unit test constructs Frame after setup_wasm |
| A3 | unit | sketch `MoleculeGraph.toFrame` still works importing Frame from `@molcrafts/molvis-core/molrs` | `npm test -w @molcrafts/molvis-sketch` |
| A4 | unit | stage (3D) package name is `@molcrafts/molvis-stage` and builds/typechecks | `npm run typecheck -w @molcrafts/molvis-stage` |
| A5 | unit | no source file outside `core/` imports `@molcrafts/molrs` | `rg` gate exit 0 |
| A6 | unit | sketch package.json does not list `@molcrafts/molrs` as direct dependency | package.json assert |
| A7 | unit | page resolves engine via `@molvis/stage` (or `@molcrafts/molvis-stage`) and typechecks | `npm run typecheck -w page` |
| A8 | unit | umbrella `@molcrafts/molvis` package exists and re-exports sketch + stage entry points | package.json + index |
| A9 | unit | root workspaces include `core`, `stage`, `sketch`, `page`, `vsc-ext` (and umbrella path) | package.json |

## Non-criteria (explicit)

- npm publish
- full regression suite green in one shot if environment-limited (must note)
- UI periodic table React component
