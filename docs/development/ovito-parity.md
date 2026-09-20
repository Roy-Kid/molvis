# OVITO modifier parity

MolVis’s Add-modifier menu follows OVITO’s folder layout, shown as
one-word nouns (Selection / Modification / Color / Structure /
Visualization / Analysis). Not every OVITO modifier exists here.
Chart-only analyses and some viewport graphics live outside the pipeline
(only steps that change the canvas are modifiers).

## Placement

| Where | What |
|-------|------|
| Pipeline Add menu | Source, Selection, Modification, Color, Structure, Visualization, Analysis (searchable; Wrap PBC is a pipeline flag under Modification) |
| Left Analysis panel | Chart-only RDF / MSD / histograms; optional “Add pipeline modifier” when results can paint the scene |
| Left compute / right draw | Structure ID and mesh steps that set `usesLeftConfig` |
| Settings | Viewport graphics (for example ambient occlusion) |

There is no separate Python-only modifier folder in the UI.

## Shipped pipeline modifiers

| Folder | Modifiers |
|--------|-----------|
| Selection | Expression select, Clear, Invert, Select type, Expand, Select overlapping, Hide selection |
| Modification | Slice, Wrap PBC (pipeline `wrapEnabled` flag, listed in the add menu), Affine, Replicate, Unwrap, Smooth trajectory, Compute property, Freeze property, Edit types, Delete selected, Hide hydrogens, Edit lattice (multi-file = multiple DataSources, not Combine modifier) |
| Color | Color by property, Color by type, Assign color |
| Structure | Steinhardt order, Solid–liquid |
| Visualization | Create bonds, Bonds, Simulation cell, Isosurface, Volume cloud, Vector field, Molecular surface, Coordination polyhedra, Generate trajectory lines |
| Analysis | Displacement vectors |

## Outside the pipeline

| Surface | Examples |
|---------|----------|
| Left Analysis | RDF, MSD, histograms, cluster (with optional “add Color by Property”) |
| Settings | SSAO / ambient occlusion and other viewport graphics |

## Not in MolVis

Python OVITO scripting, Voronoi analysis, and CNA / PTM / CSP / DXA without
molrs support remain out of scope.
