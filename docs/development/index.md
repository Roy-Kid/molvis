# Development

The MolVis engine is published as the npm package
[`@molcrafts/molvis-stage`](../api/typescript.md). This section is for
developers who want to **embed** MolVis in their own application or
**extend** it with custom behavior. If you're a user trying to visualize
molecules, begin with the [Tutorial](../tutorial/index.md)
instead.

## What you will find here

- [**Embedding**](setup.md) — add MolVis to your own web app, wire up
  the viewport, load a frame.
- [**Testing**](testing.md) — one Node unit lane per package, what a unit
  test may not touch, and how to prove a test can actually fail.
- [**Extending**](extending.md) — write a custom modifier, register a
  new command, add a mode, plug a renderer into the scene.
- [**Page plugins**](plugins.md) — domain-oriented ESM plugins
  (modifiers, modes, analysis, commands, settings, RPC).
- [**Headless rendering**](headless-rendering.md) — scripted snapshots,
  turntables, and trajectory animations.
- [**OVITO parity**](ovito-parity.md) — modifier placement and the shipped
  OVITO-shaped pipeline catalog.
- [**PCA tool**](pca-tool.md) — project per-frame properties to a 2-D scatter.

## The 30-second mental model

```
┌─────────────────────────────────────────────────────────────────┐
│ MolvisApp                                                       │
│                                                                 │
│   ┌──────────────┐   ┌────────────────┐   ┌──────────────┐      │
│   │ World        │   │ System         │   │ Artist       │      │
│   │ scene,camera │   │ trajectory,    │   │ thin-instance│      │
│   │ lights       │   │ frame events   │   │ rendering    │      │
│   └──────────────┘   └────────────────┘   └──────────────┘      │
│          ▲                    ▲                   ▲             │
│          │                    │                   │             │
│   ┌──────┴──────┐   ┌─────────┴────────┐   ┌──────┴──────┐      │
│   │ ModeManager │   │ ModifierPipeline │   │ SceneIndex  │      │
│   │ 5 modes     │   │ modifier chain   │   │ GPU buffers │      │
│   └─────────────┘   └──────────────────┘   └─────────────┘      │
│          ▲                                                      │
│          │                                                      │
│   ┌──────┴──────────────────────────────────────────────┐       │
│   │ CommandManager — undo/redo, command registry        │       │
│   └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

Every user action flows through **commands** (so everything is
undoable). Data flows through the **pipeline** (so rendering always
reflects a deterministic function of the frame). The **Artist** owns
the GPU buffers and translates frame data into thin-instance draw
calls.

Knowing which layer a change belongs to is the most important skill
when working on MolVis. The [Extending](extending.md) page has the
layer cheatsheet.

## Related reading

- [TypeScript API Reference](../api/typescript.md) — every public
  export of `@molcrafts/molvis-stage`.
- [Python API Reference](../api/python.md) — the Jupyter widget
  surface.
- [MolVis on GitHub](https://github.com/molcrafts/molvis) — source,
  issues, and release history.

## Working against molrs and molpy dev

Python uses the sibling checkouts configured in `python/pyproject.toml`.
TypeScript uses the exact MolRS Git revision, Rust toolchain, and wasm-pack
version recorded in `core/package.json` under `molrsDevelopment`:

```bash
npm ci
npm run typecheck
npm test
```

Install Git and Rust through rustup first. Core's build and test configurations
fetch the pinned source into `.cache/molrs`, install the pinned Rust toolchain
and WASM target, and reuse the matching wasm-pack or install its exact version
into that cache. Cargo builds with `--locked`; release optimization is enabled
and the separate wasm-opt step is disabled. No sibling MolRS checkout is read
or modified. CI uses the same build configurations.

The result replaces the installed npm WASM package and records its provenance
inside `node_modules/@molcrafts/molrs`. Subsequent builds reuse it; after `npm ci`
restores the registry artifact, the next core build or test rebuilds the pinned
package using the source and Cargo caches. Update the full Git SHA and tool
versions in `molrsDevelopment` deliberately to change the development build.
An interrupted process can leave `.cache/molrs/building`; after confirming no
build is running, remove that directory before retrying. A modified source cache
is rejected; remove `.cache/molrs/<revision>` to fetch a fresh copy.

The registry's 0.18.0 predates these APIs. `npm run check:molrs-release` and core's
publish hook reject a source-built development dependency. To release MolVis,
first publish a compatible MolRS npm artifact, update the dependency, and remove
the development build override. A successful development build is not proof
that the declared registry dependency is ready to publish.

Species is `atoms.atomic_number` (uint; 0 is wildcard). MolVis derives display
symbols from it and accepts raw `element` symbols at file boundaries. Chemistry
converts symbols with molrs `fillAtomicNumbers`; symbol-based exports convert
an owned copy with `fillSymbols`. `Box` takes a `Cell`, an origin and a
three-boolean PBC tuple. Perception modifies an owned copy. Mrec uses
`new MrecReader(source)` / `new MrecFile(source)`, and streamed frames use
`readWireFrame(payload, encoding)`. MSD and VACF receive arrays of per-frame
records rather than a stacked trajectory object.
