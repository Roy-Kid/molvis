# @molvis/core

Core rendering and interaction library for MolVis.

## Install

```bash
npm install @molvis/core
```

## Quick Start

```ts
import { mountMolvis, readFrame } from "@molvis/core";

const container = document.getElementById("viewer");
if (!container) {
  throw new Error("viewer container not found");
}

const app = mountMolvis(container);
const frame = readFrame("example.pdb", pdbText);
app.loadFrame(frame);
app.start();
```

## Dev Commands

```bash
npm run build -w core        # library build (dist/)
npm run dev -w core          # demo dev server
npm run test -w core         # unit tests
npm run release:check -w core
```

## Known Limitations (v0.0.2)

- `WrapPBCModifier` is currently a validated no-op.
- `DataSourceModifier` visibility toggles are state-only and do not filter blocks yet.
- `SetFrameMetaCommand` is reserved and currently does not mutate frame metadata.

## License

BSD-3-Clause. See [LICENSE](./LICENSE).
