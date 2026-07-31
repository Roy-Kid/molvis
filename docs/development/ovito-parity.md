# OVITO modifier parity

MolVis’s Add-modifier menu is **OVITO-shaped** (Selection / Modification /
Coloring / Visualization), but not every OVITO modifier is implemented, and
some capabilities live under **left Analysis** or **Settings** instead of the
pipeline (iron law: only scene-changing steps are modifiers).

## Authoritative matrix

The full row-by-row comparison lives in the project notes (kept in git, updated
when a parity wave ships):

[`.claude/notes/ovito-modifier-parity.md`](../../.claude/notes/ovito-modifier-parity.md)

That file excludes **Python** modifiers and **Voronoi**-related features by
product decision.

## Placement rules (short)

| Where | What |
|-------|------|
| Pipeline Add menu | **OVITO folders**: Selection, Modification, Coloring, Structure identification, Visualization, Analysis |
| Left Analysis panel | Chart-only RDF/MSD/histograms (not Add-menu); optional “Add pipeline modifier” when results can paint |
| Left compute / right draw | Structure ID / mesh steps (`usesLeftConfig`) |
| Settings | Viewport graphics (e.g. ambient occlusion) |

Python folder is intentionally omitted.

## Priority backlog (from the matrix)

| Priority | Gaps |
|----------|------|
| **P0** | ~~Replicate; Unwrap~~ (shipped) |
| **P1a** | ~~Compute / Freeze / Edit types / Select overlapping / Displacement~~ (shipped) |
| **P1b** | ~~Coordination polyhedra; Trajectory lines; Construct surface mesh~~ (shipped) |
| **P2** | ~~Smooth trajectory; SSAO; Edit lattice UX~~ (shipped) |
| **OOS** | Python; Voronoi\*; CNA/PTM/CSP/DXA without molrs |

Shipped parity batches: `ovito-parity-01` … `05` (see `.claude/specs/INDEX.md` shipped section).
