# The modifier pipeline

The **pipeline** is an ordered transformation from loaded source data to the
frame that MolVis renders. It makes data operations visible, reorderable, and
undoable instead of hiding them in one-off UI actions.

## Read a pipeline from top to bottom

Consider this sequence:

```text
DataSource → Slice → ExpressionSelect → ColorByProperty → rendered frame
```

Each modifier receives the previous modifier's output. Reordering therefore
changes meaning. Selecting atoms before slicing can preserve a named selection
that includes atoms later removed from view; slicing first limits what the
expression can see.

## Source versus derived frame

The DataSource modifier owns the original structure or trajectory. Later
modifiers operate on working frames. This gives MolVis two useful guarantees:

- disabling or deleting a modifier can recover upstream data;
- exporting the rendered result does not require overwriting the original file.

The scene is rebuilt from the active pipeline output. Representation remains a
global visual setting outside the molecular data path, so changing from
wireframe to spacefill does not insert a modifier.

## Common modifier categories

Aligned with OVITO’s Add-modifier groups:

| Category (OVITO) | Examples | Effect |
|---|---|---|
| Selection | Expression Select, Clear / Invert / Select Type / Expand / Select overlapping, Hide Selection | Create or act on a selection set |
| Modification | Slice, Wrap PBC, Affine, Replicate, Unwrap, Smooth trajectory, Compute/Freeze property, Edit types, Delete Selected, Hide Hydrogens | Edit topology or coordinates |
| Coloring | Color by Property, Color by Type, Assign Color | Per-atom color |
| Structure identification | Steinhardt order, Solid–liquid | Local structure → atom columns (molrs) |
| Visualization | Create bonds, Bonds, Simulation cell, Create isosurface, Vector field, Gaussian density / Construct surface mesh, Coordination polyhedra, Generate trajectory lines | Scene visuals |
| Analysis | Displacement vectors | Pipeline property compute that feeds viz |

Chart-only analyses (RDF, MSD, histograms, …) stay in the **left Analysis** panel — same iron law as before; they are not Add-menu items.

**Iron law:** only steps that change the canvas belong in the pipeline. Charts
and pure numerical analyses (RDF, MSD, spectra, …) live in the **left Analysis
panel**, driven by the molrs compute catalog.

**Left compute / right draw:** analysis-nature pipeline modifiers (Steinhardt,
solid–liquid, Gaussian density, vector field, isosurface, …) open the **left**
panel for algorithm parameters when added or selected. The pipeline bottom pane
shows **drawing** parameters only (colors, isovalue, opacity, scale). Pure
Analysis tools that can also paint the scene (e.g. Cluster) expose a button to
**add a right-side** Color by Property (or similar) modifier.

Full OVITO ↔ MolVis gap table (and backlog):
[OVITO parity](../development/ovito-parity.md).

Visual elements such as **Particles** and **Ribbon** auto-attach when a file
loads.

Use the eye control to mute a modifier without deleting its configuration.
Drag to reorder. Use Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z to undo and redo command
history.

## A prediction exercise

Imagine selecting `element O`, assigning those atoms red, then hiding the same
selection. The color modifier still runs, but its result is invisible because a
later modifier removes the target atoms. Moving Hide selection above Assign
color means the color modifier receives no selected oxygen atoms.

## Checkpoint

Given two modifiers, you should be able to ask which one receives the other's
output. Next, add time by learning how a [trajectory](trajectory.md) supplies a
different source frame at each index while reusing one pipeline definition.
