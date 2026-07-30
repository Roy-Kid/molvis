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
| Pipeline | Changes frame data or the canvas |
| Left Analysis | Charts / tables / series; optional “Add pipeline modifier” when results can paint |
| Left compute / right draw | Analysis-nature pipeline steps (`usesLeftConfig`) |
| Settings | Viewport graphics (e.g. ambient occlusion) |

## Priority backlog (from the matrix)

| Priority | Gaps |
|----------|------|
| **P0** | ~~Replicate; Unwrap~~ (shipped) |
| **P1a** | ~~Compute property; Freeze; Edit types; Select overlapping; Displacement vectors~~ (shipped) |
| **P1b** | Coordination polyhedra; Trajectory lines; Surface-mesh polish |
| **P2** | Smooth trajectory; Ambient occlusion wiring; Edit-cell UX polish |
| **OOS** | Python; Voronoi\*; CNA/PTM/CSP/DXA without molrs |

Shipped parity batches: `ovito-parity-01` … `05` (see `.claude/specs/INDEX.md` shipped section).
