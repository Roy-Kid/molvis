# MolVis

**A visual workspace where people and agents inspect molecular data together.**

MolVis for VS Code is the same product surface as the web and Jupyter hosts:
molecules, simulation boxes, and trajectories on a 3D **stage**, a 2D
**sketch** editor, and a bidirectional RPC layer so an agent can operate the
live scene while you review the result.

Documentation: [docs.molcrafts.org/molvis](https://docs.molcrafts.org/molvis/)
· [VS Code guide](https://docs.molcrafts.org/molvis/interfaces/vscode/)

## Install

Search **MolVis** in the Extensions view (publisher **molcrafts**) or open
the [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=molcrafts.molvis).
Requires VS Code 1.120.0 or newer.

## Use

1. Click the **MolVis** icon in the Activity Bar. **Files** lists workspace
   molecular files. After a Stage or Sketch tab loads, its outline appears
   below Files. The canvases themselves open as editor tabs.
2. Or run **MolVis: Open Stage** / **Open Sketch** / **Open Page**, or
   right-click in Explorer.

| Surface | Command | Use it when |
|---------|---------|-------------|
| **Stage** | `MolVis: Open Stage` | 3D session in an editor tab |
| **Sketch** | `MolVis: Open Sketch` | 2D session in an editor tab |
| **Page** | `MolVis: Open Page` | Full product shell (same as the web app) |
| **Quick View** | `MolVis: Quick View` | 3D peek beside the source file |
| **Files** | Activity Bar | Workspace + recent files |

Same engines as the web product. Each command opens one surface.

## Formats

Text structures open as Quick View (optional editor): PDB, XYZ/ExtXYZ, CIF/mmCIF,
LAMMPS data and dump, SDF/MOL, Cube, CHGCAR, GRO, MOL2, POSCAR/CONTCAR.

Binary trajectories (DCD, TRR, XTC) open as the trajectory viewer. Zarr
directories load through **MolVis: Open Structure…**.

## Commands

- `MolVis: Open Stage`
- `MolVis: Open Sketch`
- `MolVis: Open Page`
- `MolVis: Open Structure…`
- `MolVis: Quick View`
- `MolVis: Reload View` (when a MolVis editor is active)

Settings: `molvis.config` (mount) and `molvis.settings` (runtime). See
[configuration](https://docs.molcrafts.org/molvis/interfaces/vscode/configuration/).

## License

BSD-3-Clause
