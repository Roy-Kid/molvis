# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-02-04

### Added
- Initial release of Molvis molecular visualization toolkit
- **Core Library (@molvis/core)**
  - Interactive 3D molecular visualization using Babylon.js
  - Support for multiple file formats (PDB, XYZ, LAMMPS data)
  - Trajectory playback and animation support
  - Multiple rendering modes (view, select, edit, manipulate, measure)
  - Scene management and synchronization
  - Modifier pipeline for data processing
  - Command system with undo/redo support
  - WASM-based molecular data processing via molwasm
  - Imposter rendering for improved performance
  - Custom shader support

- **Web Application (page)**
  - React-based web interface for molecular visualization
  - Integrated UI controls and panels
  - Timeline control for trajectory playback
  - Settings and export dialogs
  - Responsive layout with resizable panels

- **Python Widget (@molvis/python)**
  - Jupyter notebook widget integration
  - Python API for molecular visualization

- **VSCode Extension (molvis)**
  - Custom editor for molecular structure files (.pdb, .xyz, .data)
  - Preview command for quick visualization
  - Integrated webview panel

### Changed
- Migrated from local `molrs-wasm` dependency to published `molwasm` package

### Fixed
- Code quality improvements: replaced 138+ linting issues
- Removed `any` types and improved type safety
- Replaced `forEach` with `for...of` loops for better performance
- Removed non-null assertions with proper null checks
- Optimized demo performance

### Technical Details
- TypeScript codebase with strict type checking
- Monorepo structure using npm workspaces
- Build tools: Rsbuild for bundling
- Code quality: Biome for formatting and linting
- License: BSD-3-Clause

[0.0.1]: https://github.com/molcrafts/molvis/releases/tag/v0.0.1
