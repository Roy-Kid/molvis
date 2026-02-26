# MolVis

**Interactive molecular visualization toolkit built with modern web technologies.**

MolVis is a high-performance molecular visualization toolkit that brings interactive 3D molecular graphics to the web, desktop, and Jupyter notebooks. Built on [Babylon.js](https://www.babylonjs.com/) and powered by WebAssembly, it delivers smooth, real-time rendering of large molecular systems.

## Features

- **High Performance** -- WebAssembly-powered molecular data processing with GPU-accelerated rendering
- **Multiple Rendering Modes** -- View, select, edit, manipulate, and measure molecular structures
- **Trajectory Support** -- Smooth playback and analysis of molecular dynamics trajectories
- **Extensible Pipeline** -- Modular modifier system for custom data transformations
- **Modern Stack** -- TypeScript, React, Babylon.js, and Rsbuild
- **Multiple Interfaces** -- Web app, Jupyter widget, and VSCode extension

## Packages

| Package | Description |
|---------|-------------|
| `@molvis/core` | Core TypeScript library with rendering engine, command system, and pipeline |
| `page/` | React web application with responsive UI |
| `python/` | Jupyter notebook widget for inline visualization |
| `vsc-ext/` | VSCode extension for molecular file editing |

## Supported File Formats

- **PDB** -- Protein Data Bank format
- **XYZ** -- Standard Cartesian coordinates
- **LAMMPS Data** -- LAMMPS data files with topology

## Quick Links

- [Getting Started](getting-started.md) -- Installation and basic usage
- [Architecture](architecture.md) -- System design and key concepts
- [Core API Reference](api/core.md) -- TypeScript API documentation
- [Core Release Checklist](release/core-release-checklist.md) -- Manual release runbook
- [Source Code](https://github.com/molcrafts/molvis) -- GitHub repository
