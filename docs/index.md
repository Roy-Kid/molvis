# MolVis

**Interactive 3D molecular visualization for the web, VSCode, and Jupyter.**

MolVis renders molecules, simulation boxes, and trajectories straight in the
browser. It understands the common chemistry file formats (PDB, XYZ,
LAMMPS, Zarr), plays back molecular dynamics frame-by-frame, and lets you
build, analyze, and annotate structures without ever leaving your editor
or notebook.

<figure>
  <img src="assets/hero.png" alt="MolVis showing a solvated protein with the simulation box outlined" />
  <figcaption>MolVis running as the web app — left sidebar holds analysis tools, the canvas is the viewport, and the right sidebar holds mode-specific controls.</figcaption>
</figure>

## What you can do

- **Open a molecule** — drag a `.pdb`, `.xyz`, `.data`, or `.dump` onto the
  canvas; MolVis figures out the format from the extension.
- **Fly the camera** — orbit, pan, zoom in an OVITO-style viewport with
  depth cues and grid.
- **Work in modes** — switch between *View*, *Select*, *Edit*,
  *Manipulate*, and *Measure* without losing your place.
- **Apply a pipeline** — chain modifiers (slice, expression-select, color
  by property, wrap PBC, …) and re-order them at any time.
- **Play a trajectory** — scrub through thousands of frames smoothly; MolVis
  only rebuilds GPU buffers when the topology actually changes.
- **Export** — save screenshots at arbitrary DPI, dump a modified frame
  back to XYZ, or hand the current pipeline off to Python.

## Where to start

<div class="grid cards" markdown>

- :material-play-circle: **[Getting Started](getting-started/index.md)**  
  Install MolVis as a web app or VSCode extension and load your first
  structure.

- :material-code-braces: **[Development](development/index.md)**  
  Embed `@molcrafts/molvis-core` in your own app or extend it with
  custom modifiers and commands.

- :material-book-open-page-variant: **[API Reference](api/typescript.md)**  
  The full TypeScript surface of `@molcrafts/molvis-core` plus the Python
  widget API.

</div>

## Project layout

MolVis is a monorepo. Each package is usable on its own:

| Package | What it is | Who it's for |
|---------|------------|--------------|
| [`@molcrafts/molvis-core`](api/typescript.md) | TypeScript rendering + pipeline engine | Developers embedding MolVis |
| [`page`](getting-started/web.md) | React web app, three-panel layout | End users |
| [`molvis` VSCode extension](getting-started/vscode.md) | Custom editor for chemistry files | End users working in VSCode |
| [`molvis` Python widget](api/python.md) | Jupyter anywidget | Notebook / scripting users |

## Supported file formats

| Format | Extensions | Multi-frame | Box |
|--------|-----------|-------------|-----|
| Protein Data Bank | `.pdb` | yes (MODEL records) | CRYST1 |
| Extended XYZ | `.xyz` | yes | via lattice comment |
| LAMMPS data | `.data` | no | yes |
| LAMMPS dump | `.dump`, `.lammpstrj` | yes | yes |
| Zarr trajectory | `.zarr/` directory | yes | yes |

## Source

Source, issues, and releases live at
[github.com/molcrafts/molvis](https://github.com/molcrafts/molvis).
