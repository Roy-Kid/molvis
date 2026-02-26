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
import { mountMolvis } from '@molvis/core';

// Mount Molvis into a container element
const app = mountMolvis(document.getElementById('viewer'));
app.start();
```

The `mountMolvis` function accepts an optional config and settings object:

```typescript
import { mountMolvis } from '@molvis/core';
import type { MolvisConfig, MolvisSetting } from '@molvis/core';

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
app.start();
```

### Loading a Structure

Use the command system to load molecular structures:

```typescript
import { readFrame } from '@molvis/core';

// Read a frame from file content
const frame = readFrame('structure.pdb', pdbContent);

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
import molvis

viewer = molvis.Viewer()
viewer.load('structure.pdb')
viewer.show()
```

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
