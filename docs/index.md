# MolVis

**Interactive 3D molecular visualization for the web, VSCode, and Jupyter.**

MolVis renders molecules, simulation boxes, and trajectories straight in
the browser. It understands the common chemistry file formats (PDB, XYZ,
LAMMPS, Zarr), plays back molecular dynamics frame-by-frame, and lets you
build, analyze, and annotate structures without leaving your editor or
notebook.

![MolVis showing a solvated protein with the simulation box outlined](assets/hero.png)

## What you can do

- **Open a molecule** — drag a `.pdb`, `.xyz`, `.data`, or `.dump` onto
  the viewport; MolVis figures out the format from the extension.
- **Fly the camera** — orbit, pan, and zoom with depth cues and a
  configurable grid.
- **Work in modes** — switch between *View*, *Select*, *Edit*,
  *Manipulate*, and *Measure* without losing your place.
- **Apply a pipeline** — chain modifiers (slice, expression-select,
  color by property, wrap PBC, …) and re-order them at any time.
- **Play a trajectory** — scrub through thousands of frames smoothly.
- **Export** — screenshots at arbitrary DPI, structures back to XYZ.

## Where to start

- [**Getting Started**](getting-started/index.md) — pick the web viewer
  or the VSCode extension and load your first structure.
- [**Development**](development/index.md) — embed MolVis in your own
  application or extend it with custom modifiers and commands.
- [**API Reference**](api/typescript.md) — the TypeScript library and
  the Python package.

## How to run MolVis

| | Where it runs | Install |
|---|---|---|
| **Web viewer** | [molvis.molcrafts.org](https://molvis.molcrafts.org) | nothing — just open the page |
| **VSCode extension** | any VSCode workspace (local, WSL, or SSH remote) | install from the Marketplace |
| **Jupyter widget** | any Jupyter notebook | `pip install molvis` |
| **Embedded library** | your own web app | `npm install @molcrafts/molvis-core` |

## Supported file formats

| Format | Extensions | Multi-frame | Box |
|--------|-----------|-------------|-----|
| Protein Data Bank | `.pdb` | yes (MODEL records) | CRYST1 |
| Extended XYZ | `.xyz` | yes | via lattice comment |
| LAMMPS data | `.data` | no | yes |
| LAMMPS dump | `.dump`, `.lammpstrj` | yes | yes |
| Zarr trajectory | `.zarr/` | yes | yes |

## Source

Source, issues, and releases live at
[github.com/molcrafts/molvis](https://github.com/molcrafts/molvis).
Released under BSD-3-Clause.
