# `@molcrafts/molvis-stage`

3D stage engine for MolVis: Babylon.js rendering, commands, modes, OVITO-shaped
modifier pipeline, selection, and JSON-RPC.

## Install

```bash
npm install @molcrafts/molvis-stage
```

Need 2D sketching as well? Use `@molcrafts/molvis-sketch`, or install both via
the umbrella package `@molcrafts/molvis`.

## Quick start

```ts
import { mountMolvis } from "@molcrafts/molvis-stage";
import { loadFileContent } from "@molcrafts/molvis-stage/io";

const container = document.getElementById("viewer");
if (!container) throw new Error("viewer container not found");

const app = mountMolvis(container);
await app.start();

const pdbText = await (await fetch("/structure.pdb")).text();
await loadFileContent(app, pdbText, "structure.pdb");
```

Entry points:

| Import | Role |
|--------|------|
| `@molcrafts/molvis-stage` | Application, rendering, analysis, pipeline, types |
| `@molcrafts/molvis-stage/io` | Format loaders, trajectory sources, writers |
| `@molcrafts/molvis-stage/viewer` | Registers `molvis-viewer` / `molvis-style-gallery` |

## Dev commands

```bash
npm run build -w @molcrafts/molvis-stage
npm run dev -w @molcrafts/molvis-stage
npm run test -w @molcrafts/molvis-stage
npm run release:check -w @molcrafts/molvis-stage
```

## Related packages

| Package | Role |
|---------|------|
| `@molcrafts/molvis-stage` | This package — 3D engine |
| `@molcrafts/molvis-sketch` | 2D sketcher |
| `@molcrafts/molvis` | Umbrella re-export |
| `@molcrafts/molvis-core` | Workspace-private molrs gateway + element data |

## License

BSD-3-Clause. See [LICENSE](./LICENSE).