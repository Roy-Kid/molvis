# Getting Started

## Installation

### Using npm (core library)

```bash
npm install @molvis/core
```

### From Source

```bash
git clone https://github.com/molcrafts/molvis.git
cd molvis
npm install
```

## Basic Usage

### TypeScript / JavaScript

```typescript
import { mountMolvis } from "@molvis/core";

const container = document.getElementById("viewer");
if (!container) {
  throw new Error("viewer container not found");
}

const app = mountMolvis(container);
await app.start();
```

The `mountMolvis` function accepts an optional config and settings object:

```typescript
import { mountMolvis } from "@molvis/core";
import type { MolvisConfig, MolvisSetting } from "@molvis/core";

const config: MolvisConfig = {
  showUI: true,
  canvas: {
    antialias: true,
    alpha: false,
  },
};

const settings: Partial<MolvisSetting> = {
  // custom settings
};

const app = mountMolvis(container, config, settings);
await app.start();
```

### Loading a Structure

Use the command system to load molecular structures:

```typescript
import { readFrame } from "@molvis/core";

// Read a frame from file content
const frame = readFrame(pdbContent, "structure.pdb");

// Load and render the frame
app.loadFrame(frame);
```

### Edit Workflow (Staging)

Edit mode works as a staging session: changes are buffered first, then merged back to frame data.

```typescript
// Enter edit mode (promotes current frame entities into the edit pool)
app.setMode('edit');
// Do add/delete/move operations in the canvas

// Leave edit mode
app.setMode('view'); // If dirty, UI prompts: keep or discard staged edits
```

In edit mode:

- Right-click atom/bond deletes it from the staged pool.
- Press `Ctrl+S` to sync staged data back to the current frame immediately.

### Python (Jupyter)

```python
import molvis as mv
import molpy as mp

scene = mv.Molvis(name="demo", session="shared-demo")
frame = mp.Frame(...)
scene.draw_frame(frame)
scene
```

MolVis uses binary anywidget buffers for dense numeric arrays automatically, so large coordinate arrays are not expanded into JSON lists.

If you reuse the same `session` key in multiple widget handles, those cells share one frontend scene and one Babylon.js engine:

```python
primary = mv.Molvis(name="primary", session="protein")
secondary = mv.Molvis(name="secondary", session="protein")
```

Frontend validation and runtime failures are returned to Python as `mv.MolvisRpcError`.

## Canonical Field Names

All packages in the molcrafts ecosystem (molpy, molrs, molvis) share a
single set of canonical column names for Frame data. When writing readers,
modifiers, or renderers you **must** use these names — the normalization
layers will reject or silently misinterpret non-canonical columns.

The authoritative definitions live in `molpy.core.fields`.

### Atom columns

| Field | dtype | Description |
|-------|-------|-------------|
| `element` | string | Element symbol (e.g. `"C"`, `"Fe"`) |
| `type` | string | Force-field type label |
| `id` | i64 | Atom ID (1-indexed) |
| `x`, `y`, `z` | f64 | Cartesian coordinates (Angstrom) |
| `vx`, `vy`, `vz` | f64 | Velocities (Angstrom/fs) |
| `charge` | f64 | Partial charge (e) |
| `mass` | f64 | Atomic mass (amu) |
| `mol_id` | i64 | Molecule ID (1-indexed) |
| `res_id` | i64 | Residue ID |
| `res_name` | string | Residue name |

### Bond columns

| Field | dtype | Description |
|-------|-------|-------------|
| `atomi` | i64 | First atom index (0-indexed) |
| `atomj` | i64 | Second atom index (0-indexed) |
| `type` | string | Bond type label |
| `order` | f32 | Bond order (1, 1.5, 2, 3) |

### Angle / Dihedral columns

| Field | dtype | Description |
|-------|-------|-------------|
| `atomi`, `atomj`, `atomk` | i64 | Angle vertex indices (0-indexed) |
| `atoml` | i64 | Fourth vertex for dihedrals |
| `type` | string | Angle/dihedral type label |

### Format-specific aliases

File-format readers (LAMMPS, PDB, XYZ, …) may produce non-canonical
column names. The normalization layer (`reader.ts` in molvis,
`FieldFormatter.canonicalize` in molpy) maps them automatically:

| Alias | Canonical | Where |
|-------|-----------|-------|
| `symbol`, `species`, `type_symbol` | `element` | Atom identity |
| `i` / `j` | `atomi` / `atomj` | PDB, SMILES bond indices |
| `atom_i` / `atom_j` | `atomi` / `atomj` | LAMMPS bond indices |
| `q` | `charge` | LAMMPS charge |
| `mol` | `mol_id` | LAMMPS molecule ID |

When adding a new I/O format, define a `FieldFormatter` subclass in molpy
(see `molpy/docs/developer/extending-io.md`) and add matching entries to
`BOND_COLUMN_ALIASES` / `ATOM_COLUMN_ALIASES` in `core/src/reader.ts`.

## Development

### Prerequisites

- Node.js 18+
- npm

### Running the Dev Server

```bash
# Core library (watch mode)
npm run dev:core

# Web application
npm run dev:page

# Python widget
npm run dev:python
```

Visit `http://localhost:3000` to see the web application.

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Core release preflight
npm run release:check -w core
```

### Code Quality

```bash
npx biome check --write
```

## Building for Production

```bash
# Build all packages
npm run build:all

# Or build individually
npm run build:core
npm run build:page
npm run build:python
```
