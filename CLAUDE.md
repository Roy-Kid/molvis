---
mol_project:
  stage: experimental
  language: typescript
  specs_path: .claude/specs/
  notes_path: .claude/notes/
  arch:
    style: monorepo
  build:
    command: npm run build:all
    test: npm test
    lint: npm run lint
    format: npm run lint
    typecheck: npm run typecheck
  doc:
    style: TSDoc/JSDoc
  dev:
    command: npm run dev:page
    ready_pattern: "Local:"
    url_pattern: "(http://localhost:\\d+)"
---

# CLAUDE.md

<!-- mol:bootstrap:managed begin -->

## What this repo is

MolVis — interactive molecular visualization library. Web-first,
WASM-accelerated, with VSCode and Jupyter integration. Monorepo:
TypeScript core engine (`@molcrafts/molvis-core`), React 19 web app (`page/`),
VSCode extension (`vsc-ext/`), Python package (`python/`).

## Where things live

| What | Where |
|------|-------|
| Source | `core/src/`, `page/src/`, `vsc-ext/src/`, `python/src/` |
| Tests | `core/tests/`, `page/tests/`, `vsc-ext/tests/`, `python/tests/` |
| Public docs | `docs/` |
| Passive knowledge (decisions, architecture, style) | `.claude/notes/` |
| Active specs (ephemeral, deleted on completion) | `.claude/specs/` |
| Agent runtime (skills, agents, hooks) | `.claude/skills/`, `.claude/agents/` |

## Build & test

```bash
npm install
npm run dev:page       # page dev server at localhost:3000
npm run build:all      # core + page + vsc-ext
npm test               # full suite
npm run typecheck      # tsc --noEmit (all workspaces)
npm run lint           # biome check --write
```

## Monorepo structure

| Package | Path | Purpose |
|---------|------|---------|
| `@molcrafts/molvis-core` | `core/` | Engine: commands, modes, pipeline, rendering |
| `page` | `page/` | React 19 web app — single frontend for all hosts |
| `molvis` (ext) | `vsc-ext/` | VSCode extension (custom editor for .pdb/.xyz/.data) |
| `molcrafts-molvis` (pypi) | `python/` | Python package — drives page bundle over WebSocket |

`page/` and `vsc-ext/` bundle `@molcrafts/molvis-core` from source via tsconfig
`paths` + rsbuild alias. Core's `dist/` is for npm publish only.
`npm run build:page` copies `page/dist/` into `python/src/molvis/dist/`.

## Critical invariants

- **Immutability**: all data transforms return new objects; never mutate
- **Command do()/undo() symmetry** — every reversible operation has undo
- **Pipeline is the single scene-data ingress** — never bypass
  `DataSourceModifier` when loading; both GUI and RPC funnel through it
- **`UpdateFrameCommand` must never call `sceneIndex.registerFrame()`**
- **`core/src/index.ts` must never re-export from `./charts`** (tree-shake)
- Subpath exports (`./io`, `./io/formats`, `./charts`) are public API

## Architecture notes → `.claude/notes/`

| File | Content |
|------|---------|
| `core-arch.md` | Layer separation, command/mode/pipeline/RPC system, thin instances |
| `wasm-api.md` | molrs Frame/Block/Box/Grid WASM API reference |
| `frontend-style.md` | Sidebar UI design language (typography, spacing, color, patterns) |
| `architecture.md` | Blueprint populated by `/mol:map` |
| `product/` | Vision, differentiators, iteration records |

<!-- mol:bootstrap:managed end -->
