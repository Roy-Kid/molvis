# Setup

## Prerequisites

- **Node.js 22 or newer** (the CI runner uses 22; older versions may
  work but are not tested).
- **npm 10+**. Publishing `@molcrafts/molvis-core` through the
  Trusted Publisher workflow additionally requires npm 11.5.1, which
  the release job installs on the fly.
- **Python 3.11+** and `pip` if you intend to work on the Jupyter
  widget in `python/`.
- **Rust toolchain + wasm-pack** if you want to rebuild the WASM
  kernels shipped by `@molcrafts/molrs` from source. Pre-built bindings
  are on npm; you only need Rust for kernel work.

## Clone and install

```bash
git clone https://github.com/molcrafts/molvis.git
cd molvis
npm install
```

`npm install` wires up the workspaces, resolves
`@molcrafts/molvis-core` from `core/src` into `page/`, `vsc-ext/`, and
`python/` via TS path aliases, and fetches `@molcrafts/molrs` from the
npm registry.

## Monorepo layout

| Directory | What it is |
|---|---|
| `core/` | `@molcrafts/molvis-core` — rendering, commands, modes, pipeline |
| `page/` | React 19 web application (`npm run dev:page`) |
| `vsc-ext/` | VSCode extension (custom editor) |
| `python/` | Jupyter widget (`anywidget`) |
| `docs/` | This site (Zensical) |
| `.github/workflows/` | CI and release automation |

`page/`, `vsc-ext/`, and `python/` all consume `core/` from source via
`@molvis/core` (an internal alias; the published name is
`@molcrafts/molvis-core`). You do **not** need to run `npm run build:core`
before starting any of the frontends in dev mode.

## Daily loop

One dev server at a time (they all want port 3000):

```bash
npm run dev:page       # web app
npm run dev:core       # core demo (core/examples/*)
npm run dev:python     # Python widget watcher
```

Linting:

```bash
npx biome check --write
```

Type checking across the monorepo:

```bash
npm run typecheck
```

Tests:

```bash
npm run test:core        # rstest (unit + browser via Playwright)
npm run test:vsc-ext     # mocha unit tests
npm test                 # everything, in workspace-declaration order
```

## Building

```bash
# everything, in dependency order (core → python → page → vsc-ext)
npm run build:all

# just one package
npm run build:core
npm run build:page
npm run build:vsc-ext
```

`build:core` emits the `core/dist/` tarball for npm publishing.
`build:page` and `build:vsc-ext` bundle `core` from source, so they do
not require `dist/` to exist.

## WASM kernels (advanced)

`@molcrafts/molrs` lives in a sibling repo
([molcrafts/molrs](https://github.com/molcrafts/molrs)). When iterating
on the kernels, clone it next to `molvis/` and link locally:

```bash
# in molrs/molrs-wasm
wasm-pack build --release --target bundler --scope molcrafts
# then, in molvis/
npm install ../molrs/molrs-wasm/pkg
```

The rslib/rsbuild toolchain picks up the new `pkg/` without a reinstall
because the link is a symlink. Remember to revert to the published
version before pushing — CI cannot resolve `link:` specifiers.

## Publishing

Both `@molcrafts/molvis-core` and the VSCode extension publish from
tags.

- **Core to npm**: push a `v*` tag; the `Release Core` workflow runs
  under the `release-core` environment and publishes via npm's
  Trusted Publisher (OIDC, no `NPM_TOKEN`).
- **Extension to Marketplace**: run `cd vsc-ext && npx @vscode/vsce publish --no-dependencies`
  and `npx ovsx publish --no-dependencies` locally. A tag-triggered
  workflow is deliberately not wired up; the release engineer smoke-tests
  the VSIX before publishing.
