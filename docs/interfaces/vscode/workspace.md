# Stage, Sketch, and the Activity Bar

Stage and Sketch are peer editor tabs. The Activity Bar never hosts a canvas.

- **Stage** — 3D editor tab (`@molcrafts/molvis-stage`)
- **Sketch** — 2D editor tab (`@molcrafts/molvis-sketch`)
- **Page** — full product shell (`MolVis: Open Page`), same as the web app
- **Files** — workspace molecular files plus recent paths
- **Stage** outline — chain / residue / atom tree of the open Stage
- **Sketch** outline — atoms and bonds of the open Sketch

## Files

The Activity Bar **Files** view scans the workspace for molecular formats and
keeps a Recent section. Click a coordinate/trajectory file to open Stage; click
a `.mol` / `.sdf` file to open Sketch. The view title bar has **Open
Structure…** (picker, routed by format) and **Refresh**. Right-click a row for
Quick look.

Empty workspace: **Open Structure…** from the welcome.

## Open Stage

- Click a non-MOL/SDF file in **Files**
- **MolVis: Open Structure…** (non-sketch formats)
- Explorer → **MolVis: Open Stage**
- **MolVis: Open Stage** (empty tab, or the active editor if it is molecular)

The Stage tab owns the 3D canvas. Its outline appears in the Activity Bar
after a frame loads.

## Open Sketch

- Click a `.mol` / `.sdf` file in **Files**
- **MolVis: Open Sketch**
- Explorer → **MolVis: Open Sketch**

The Sketch tab owns the 2D canvas. Its outline appears in the Activity Bar
after a molecule loads.

## Outlines

After a tab loads a molecule, the matching outline lists hierarchy (Stage) or
atoms/bonds (Sketch). Click a node to select those atoms on that tab.

## Related commands

| Command | Role |
|---------|------|
| Quick look | 3D peek beside the source file |
| Quick look (Sketch) | 2D peek beside a MOL/SDF file |
| Open Structure… | Pick a file; Stage or Sketch by format |
| Reload View | Rebuild the active Stage or Sketch tab |

Continue with [configuration](configuration.md).
