# `@molcrafts/molvis-stage`

3D stage engine for MolVis (Babylon.js rendering, pipeline, modes, RPC).

## Install

```bash
npm install @molcrafts/molvis-stage
```

For 2D sketching use `@molcrafts/molvis-sketch`. For both:

```bash
npm install @molcrafts/molvis
```

## Quick start

```ts
import { mountMolvis } from "@molcrafts/molvis-stage";
import { loadFileContent } from "@molcrafts/molvis-stage/io";

const container = document.getElementById("viewer");
if (!container) throw new Error("viewer container not found");

const app = mountMolvis(container);
await app.start();
```

## Dev commands

```bash
npm run build -w @molcrafts/molvis-stage
npm run dev -w @molcrafts/molvis-stage
npm run test -w @molcrafts/molvis-stage
npm run release:check -w @molcrafts/molvis-stage
```

## Package layout (monorepo)

| Package | Role |
|---------|------|
| `@molcrafts/molvis-stage` | This package — 3D engine |
| `@molcrafts/molvis-sketch` | 2D sketcher |
| `@molcrafts/molvis` | Umbrella re-export |
| `@molcrafts/molvis-core` | Workspace-private molrs gateway + element data |

## License

BSD-3-Clause. See [LICENSE](./LICENSE).
