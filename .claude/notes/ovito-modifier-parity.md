# OVITO ↔ MolVis modifier capability matrix

Passive inventory. Updated when a parity wave ships.  
**Excluded by product decision:** all Python-related OVITO modifiers; all
Voronoi-related features (Voronoi analysis, Voronoi voids, VoroTop).

**Placement iron law**

| Placement | Criterion |
|-----------|-----------|
| Pipeline modifier | Changes frame data and/or canvas (geometry, color, meshes, selection, cell, vectors) |
| Left Analysis | Charts/tables/series only — no automatic scene change; optional **Add pipeline modifier** when results can paint |
| Left compute / right draw | Analysis-nature pipeline steps: left = compute params; pipeline bottom = draw params (`usesLeftConfig`) |
| Settings | Viewport graphics (e.g. ambient occlusion / SSAO) — not a pipeline step |

**Status legend:** `done` · `partial` · `gap` · `oos` (out of scope / no molrs) · `n/a` (different product model)

---

## Selection

| OVITO | MolVis | Status | Notes |
|-------|--------|--------|-------|
| Expression selection | `Expression Select` | done | |
| Clear selection | `Clear Selection` | done | Empty mask (not all) |
| Invert selection | `Invert Selection` | done | Needs `selectionScopeId` in full pipeline |
| Expand selection | `Expand Selection` | done | cutoff / bonds / both |
| Select type | `Select Type` | done | element + type columns |
| Manual selection | Select mode → `SelectModifier` | partial | Interactive only; not Add-menu (intentional) |
| Hide selected (via delete/hide) | `Hide Selection` | done | Under Selection |
| Select overlapping particles | — | **gap** | Neighbor + radius; pattern Expand |
| Select type (particle type UI) | Select Type | partial | Multi-select text; no type-checkbox UI |

## Modification

| OVITO | MolVis | Status | Notes |
|-------|--------|--------|-------|
| Slice | `Slice` | done | |
| Wrap at periodic boundaries | `Wrap PBC` | done | Molecule-aware |
| Affine transformation | `Affine transformation` | done | Scale + translate; cell optional |
| Delete selected | `Delete Selected` | done | |
| — | `Hide Hydrogens` | n/a | MolVis-only convenience |
| Replicate (periodic images) | `Replicate` | done | Integer images along cell vectors |
| Unwrap trajectories | `Unwrap trajectories` | done | MIC accumulate; scrub-back re-seeds |
| Compute property | — | **gap** | P1; generalize ExpressionSelector → column write |
| Edit simulation cell | `Simulation cell` / DrawBox | partial | Manual box exists; no dedicated “edit lattice” menu item |
| Edit types | — | **gap** | P1; write element/type |
| Freeze Property | — | **gap** | P1; freeze column across frames |
| Combine datasets | Multi–DataSource compose | partial | Different model (multiple DS), not OVITO modifier |
| Load trajectory | File / DS ingress | n/a | Not a pipeline modifier by design |
| Smooth trajectory | — | gap | P2 |
| Python script | — | oos | Excluded |

## Coloring

| OVITO | MolVis | Status | Notes |
|-------|--------|--------|-------|
| Assign color | `Assign Color` | done | |
| Color coding | `Color by Property` | done | Continuous / categorical |
| Color by type | `Color by Type` | done | element categorical preset |
| Ambient occlusion | `graphics.ssao` stub | **gap** | Settings, not modifier; wire World/FX |
| Structure → color | Steinhardt / Solid–liquid | partial | Molrs structure-order, not OVITO PTM/CNA |

## Visualization

| OVITO | MolVis | Status | Notes |
|-------|--------|--------|-------|
| Create bonds | `Create bonds` | done | |
| (Bonds visual) | `Bonds` | done | Auto-attach + user-addable |
| Simulation cell | `Simulation cell` | done | |
| Create isosurface | `Create isosurface` | done | Grid block; left compute / right draw |
| Particles | `Particles` | done | Auto-attach only |
| — | `Ribbon` | n/a | Auto-attach protein path |
| — | `Vector field` | n/a | MolVis; also displacement draw path |
| — | `Gaussian density surface` | n/a | Closest to Construct surface mesh |
| Construct surface mesh | Gaussian density / MC | partial | Extend Gaussian/MC; P1 |
| Coordination polyhedra | — | **gap** | P1; Visualization + usesLeftConfig |
| Generate trajectory lines | — | **gap** | P1; overlays pattern |

## Structure identification

| OVITO | MolVis | Status | Notes |
|-------|--------|--------|-------|
| (order parameters) | Steinhardt order / Solid–liquid | partial | Pipeline Coloring + left config |
| Ackland–Jones / CNA / PTM / CSP / Chill+ / Diamond | — | oos | No molrs backends |
| VoroTop | — | oos | Voronoi excluded |

## Analysis (OVITO modifiers that are chart/compute)

Iron law: **left Analysis**, not Add-modifier menu (unless scene-changing).

| OVITO | MolVis | Status | Notes |
|-------|--------|--------|-------|
| Radial distribution function | RDF left panel | done | |
| Cluster analysis | Cluster left panel | partial | + button → Color by Property |
| Time series / histogram / scatter | molrs catalog / GenericAnalysis | partial | Catalog-driven |
| Find rings | `detectRings` helper | partial | Not first-class Analysis entry UX |
| Displacement vectors | MSD + Vector field | partial | Need producer → vector columns + draw |
| Atomic strain / elastic / DXA / Wigner–Seitz / grain | — | oos / gap | Need molrs; DXA/grain likely oos |
| Bond order / angle / length distributions | molrs / analysis | partial | Charts only |
| Voronoi analysis | — | oos | Excluded |
| Python-based analyses | — | oos | Excluded |

---

## Implementation priority (for specs)

| Priority | Items | Target slug / wave |
|----------|--------|-------------------|
| P0 | Replicate; Unwrap trajectories | **shipped** `ovito-parity-02-replicate-unwrap` |
| P1 | Compute property; Freeze property; Edit types; Select overlapping; Coordination polyhedra; Trajectory lines; Surface mesh polish; Displacement→vector bridge | future specs |
| P2 | Smooth trajectory; Ambient occlusion (settings); Edit-cell UX rename/polish | future |
| OOS | Python; Voronoi\*; CNA/PTM/CSP/DXA without molrs | never without deliberate note |

\* Voronoi voids / analysis / VoroTop explicitly excluded.

---

## Current Add-menu inventory (registry)

Selection: Expression Select, Clear Selection, Invert Selection, Select Type, Expand Selection, Hide Selection  

Modification: Slice, Wrap PBC, Affine transformation, Replicate, Unwrap trajectories, Delete Selected, Hide Hydrogens  

Coloring: Color by Property, Color by Type, Assign Color, Steinhardt order, Solid-liquid  

Visualization: Create bonds, Bonds, Simulation cell, Vector field, Gaussian density surface, Create isosurface  

Auto-attach only: Particles, Ribbon, Transparent  
