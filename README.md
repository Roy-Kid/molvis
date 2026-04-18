# Molvis

> Interactive molecular visualization toolkit built with modern web technologies

[![Version](https://img.shields.io/badge/version-0.0.2-blue.svg)](https://github.com/molcrafts/molvis)
[![License](https://img.shields.io/badge/license-BSD--3--Clause-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)

Molvis is a high-performance molecular visualization toolkit that brings interactive 3D molecular graphics to the web, desktop, and Jupyter notebooks. Built on [Babylon.js](https://www.babylonjs.com/) and powered by WebAssembly, Molvis delivers smooth, real-time rendering of large molecular systems with an intuitive, modern interface.

## Features

- **🚀 High Performance**: WebAssembly-powered molecular data processing with GPU-accelerated rendering
- **🎨 Multiple Rendering Modes**: View, select, edit, manipulate, and measure molecular structures
- **📊 Trajectory Support**: Smooth playback and analysis of molecular dynamics trajectories
- **🔧 Extensible Pipeline**: Modular modifier system for custom data transformations
- **⚡ Modern Stack**: TypeScript, React, and cutting-edge build tools
- **🧪 Well Tested**: Comprehensive unit tests with rstest framework
- **📦 Multiple Interfaces**: Web app, Jupyter widget, and VSCode extension

## Quick Start

### Installation

#### Using npm (for @molvis/core)

```bash
npm install @molvis/core
```

#### Using the Web Application

```bash
# Clone the repository
git clone https://github.com/molcrafts/molvis.git
cd molvis

# Install dependencies
npm install

# Start the development server
npm run dev:page
```

Visit `http://localhost:3000` to see the application.

### Basic Usage

```typescript
import { mountMolvis, readFrame } from "@molvis/core";

const container = document.getElementById("viewer");
if (!container) {
  throw new Error("viewer container not found");
}

const app = mountMolvis(container);
const response = await fetch("/structure.pdb");
const pdbText = await response.text();
const frame = readFrame(pdbText, "structure.pdb");

app.loadFrame(frame);
await app.start();
```

## Project Structure

This repository is organized as a monorepo with multiple packages:

```
molvis/
├── core/              # Core TypeScript library
│   ├── src/           # Source code
│   │   ├── commands/  # Command system with undo/redo
│   │   ├── core/      # Core rendering and scene management
│   │   ├── pipeline/  # Data processing pipeline
│   │   ├── mode/      # Interaction modes
│   │   └── ui/        # UI components
│   └── tests/         # Test files
├── page/              # React web application
│   └── src/           # Web app source
├── python/            # Python Jupyter widget
│   └── src/molvis/    # Python package source
├── vsc-ext/           # VSCode extension
│   └── src/           # Extension source
└── docs/              # Documentation and release runbooks
```

### Core Package (`@molvis/core`)

The heart of Molvis, providing:

- **Rendering Engine**: Babylon.js-based 3D visualization with custom shaders
- **Command System**: Full undo/redo support for all operations
- **Pipeline Architecture**: Extensible modifier system for data transformations
- **Multiple Modes**: View, select, edit, manipulate, and measure
- **File Format Support**: PDB, XYZ, LAMMPS data files
- **Trajectory Playback**: Timeline controls with smooth interpolation

### Web Application (`page/`)

A modern React-based interface featuring:

- Responsive layout with resizable panels
- Integrated timeline control for trajectories
- Real-time settings and property editing
- Export capabilities
- Dark/light theme support

### Python package (`molvis`)

One `mv.Molvis()` class, works in both scripts and Jupyter:

```python
import molvis as mv
import molpy as mp

viewer = mv.Molvis()              # script: opens a browser tab
viewer.draw_frame(frame)
viewer.snapshot()

scene = mv.Molvis(name="demo")    # Jupyter: mounts the page bundle in the cell
scene.draw_frame(frame)
scene
```

Bidirectional events: canvas interactions (selection, mode, frame)
flow back to Python without polling.

```python
viewer.on("selection_changed", lambda ev: print(ev["atom_ids"]))
ev = viewer.wait_for("selection_changed", timeout=30)
viewer.selection                 # Selection(atom_ids=(...), bond_ids=(...))
```

Implementation details:

- One frontend app — the `page/` bundle — drives both hosts.
- JSON-RPC 2.0 over a local WebSocket with a token handshake; numpy
  arrays ride as binary buffers instead of JSON lists.
- Frontend JSON-RPC failures are raised into Python as
  `molvis.MolvisRpcError`.

### VSCode Extension

Custom editor for molecular files with:

- Syntax highlighting for .pdb, .xyz, .data files
- Inline preview commands
- Integrated visualization panel

## Development

### Prerequisites

- Node.js 18+ (recommend using [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm))
- npm, yarn, or pnpm

### Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build all packages
npm run build:all

# Development mode for specific packages
npm run dev:core    # Core library
npm run dev:page    # Web application (also the bundle mounted in Jupyter cells)
```

### Testing

Molvis uses multiple test lanes:

- `core`: [rstest](https://rstest.rs)
- `page`: Node's built-in test runner
- `python`: `pytest`
- `vsc-ext`: TypeScript + Mocha / VS Code test host

```bash
# Run all tests
npm test

# Run tests for a specific package
npm run test -w core
npm run test -w page
npm run test -w python
npm run test -w vsc-ext
```

### Code Quality

```bash
# Lint and format
npx biome check --write
```

## Building and Publishing

### Build for Production

```bash
# Build core library
npm run build:core

# Build web application (also copies into python/src/molvis/page_dist/)
npm run build:page
```

### Publishing

```bash
# See the multi-package release runbook
open docs/release/0.0.2-release-checklist.md
```

## Architecture

### Command System

All operations are implemented as commands with `do()` and `undo()` methods, enabling full undo/redo functionality:

```typescript
class MyCommand extends Command<void> {
  async do(): Promise<void> {
    // Perform operation
  }

  async undo(): Promise<void> {
    // Reverse operation
  }
}
```

### Modifier Pipeline

Data transformations are handled through a modular pipeline:

```typescript
const modifier: Modifier = {
  id: 'wrap-pbc',
  name: 'Wrap PBC',
  enabled: true,
  modify: (frame: Frame) => {
    // Transform molecular data
    return wrappedFrame;
  }
};

pipeline.addModifier(modifier);
```

### Rendering Modes

- **View Mode**: Camera controls and visualization settings
- **Select Mode**: Atom/bond selection and inspection
- **Edit Mode**: Add, delete, modify atoms and bonds
- **Manipulate Mode**: Move, rotate selected groups
- **Measure Mode**: Distance, angle, dihedral measurements

## Technologies

- **Language**: TypeScript 5.8+
- **Rendering**: Babylon.js 7.x
- **Build Tool**: Rsbuild
- **Testing**: rstest
- **Code Quality**: Biome
- **UI Framework**: React 19
- **WASM**: molwasm (Rust-based molecular data processing)

## Supported File Formats

- **PDB** - Protein Data Bank format
- **XYZ** - Standard Cartesian coordinates
- **LAMMPS Data** - LAMMPS data files with topology

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with clear commit messages
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Run code quality checks (`npx biome check --write`)
7. Submit a pull request

### Development Guidelines

- Write tests for all new features
- Follow TypeScript best practices
- Use meaningful variable and function names
- Document public APIs with JSDoc comments
- Keep commits atomic and well-described

## Roadmap

- [ ] Additional file format support (GRO, MOL2, CIF)
- [ ] Advanced selection language
- [ ] Animation and keyframe system
- [ ] Collaborative editing features
- [ ] Plugin system for custom modifiers
- [ ] Performance profiling tools

## License

This project is licensed under the BSD-3-Clause License - see the [LICENSE](LICENSE) file for details.

## Citation

If you use Molvis in your research, please cite:

```bibtex
@software{molvis2026,
  title = {Molvis: Interactive Molecular Visualization Toolkit},
  author = {Roy Kid},
  year = {2026},
  version = {0.0.2},
  url = {https://github.com/molcrafts/molvis}
}
```

## Acknowledgments

- Built with [Babylon.js](https://www.babylonjs.com/)
- Molecular data processing powered by [molwasm](https://github.com/molcrafts/molwasm)
- Inspired by [VMD](https://www.ks.uiuc.edu/Research/vmd/), [PyMOL](https://pymol.org/), and [Ovito](https://www.ovito.org/)

## Support

- 📖 [Documentation](https://molvis.readthedocs.io) (coming soon)
- 🐛 [Issue Tracker](https://github.com/molcrafts/molvis/issues)
- 💬 [Discussions](https://github.com/molcrafts/molvis/discussions)

---

Made with ❤️ by the Molvis team
