# Spec: Scene-changing modifiers vs analysis left panel

## Summary

Iron law for placement: **only operations that change the canvas** may be
pipeline modifiers; pure numerical analysis lives in the left Analysis panel.
Complex visual modifiers (surfaces, voids, vectors, structure→color) open a
**dedicated left config page** when selected in the pipeline.

## Domain basis

OVITO splits Analysis (often chart/property compute) from Visualization /
Modification modifiers that alter the rendered scene. Molrs already exposes
compute kernels via `molrsComputeCatalog` (left panel) and mesh-capable
backends (Gaussian density, Voronoi void/domain) that should drive modifiers.

## Design

### Iron law

| Placement | Criterion |
|-----------|-----------|
| Pipeline modifier | Changes drawn geometry, visibility, colors, meshes, bonds, cell, vectors, surfaces |
| Left Analysis | Charts/tables/series only — no automatic scene change |

Python-related OVITO modifiers are out of scope.

### Left config page

When the user selects (or adds) a modifier registered with `usesLeftConfig`:

1. Open the left advanced panel (drawer on narrow, column on wide).
2. Set left mode to `modifier-config` with that modifier id.
3. Render the same property panel component as the pipeline bottom pane would.
4. Pipeline bottom pane shows a short stub for that modifier (avoid dual edit).

Simple modifiers (Slice, Assign Color, …) keep pipeline-bottom properties only.

### Menu taxonomy (phase 1+)

- **Selection**: Expression Select, Hide Selection  
- **Modification**: Slice, Wrap PBC, Delete Selected, Hide Hydrogens  
- **Coloring**: Color by Property, Assign Color  
- **Visualization**: Create bonds, Bonds, Simulation cell, Create isosurface  
  (+ later: Vector field, Gaussian density surface, Voronoi voids, structure-order)

Auto-attach only: Particles, Ribbon. Transparent: registered, not menu.

### Structure → color column names (phase 4)

| Modifier | Atom column(s) |
|----------|----------------|
| Steinhardt order | `steinhardt_q{l}` |
| Solid–liquid | `solid_liquid` |
| Bond order (env) | `env_bond_order` |

Default UX: write columns then bind Color by Property to that column.

## Files

- `stage/src/pipeline/modifier_registry.ts` — userAddable Create isosurface; later entries  
- `page/src/ui/layout/LeftShellContext.tsx` — left mode state  
- `page/src/plugins/contributions/modifier_panels.ts` — `usesLeftConfig`  
- `page/src/ui/layout/LeftSidebar.tsx` — modifier-config mode  
- `page/src/ui/modes/view/pipeline/*` — select → open left  
- `page/src/App.tsx` — wire context + open drawer  

## Tasks

1. [x] Spec + iron law docs pointers  
2. [x] LeftShellContext + App / LeftSidebar wiring  
3. [x] usesLeftConfig + isosurface left config + userAddable  
4. [x] Vector field register + left config  
5. [x] Gaussian density surface modifier (+ left config); Voronoi voids deferred (needs probe mask UX)  
6. [x] Structure-order + color chain (Steinhardt / solid-liquid). Bond-order env histogram stays analysis-only.  
7. [x] Tests + docs (voids still deferred)  

## Testing

- Registry: Create isosurface userAddable; pure analysis not registered as modifiers  
- Page: selecting isosurface sets leftMode `modifier-config`  
- Stage (later phases): mesh modifiers + column writes  

## Out of scope

- Python script modifiers  
- CNA/PTM/CSP/DXA (no molrs)  
- Moving RDF/MSD into pipeline  
