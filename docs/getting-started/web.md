# Web app

The web app (`page`) is a React 19 single-page application that wraps the
`@molcrafts/molvis-core` engine in a three-panel layout:

- **Left sidebar** — analysis tools (cluster, RDF, data inspector) and
  toggles.
- **Center canvas** — the Babylon.js viewport plus a bottom timeline when
  a trajectory is loaded.
- **Right sidebar** — controls for the active mode (*View*, *Select*,
  *Edit*, *Manipulate*, *Measure*).

## Opening the app

### Hosted

Open [molcrafts.github.io/molvis](https://molcrafts.github.io/molvis/).
The landing state shows an empty canvas with a demo structure available
from the "Load demo" button.

### Self-hosting

```bash
git clone https://github.com/molcrafts/molvis.git
cd molvis
npm install
npm run dev:page    # http://localhost:3000
```

The dev server bundles `@molcrafts/molvis-core` from source, so changes
in `core/src` hot-reload into the viewer without a rebuild.

### Minimal mode

Append `?minimal` to the URL to hide every piece of UI chrome and leave
only the canvas. This is the mode the Python widget uses when embedding
the page as an iframe.

## Loading a molecule

Three ways:

1. **Drag & drop** a file onto the canvas. Supported extensions: `.pdb`,
   `.xyz`, `.data`, `.dump`, `.lammpstrj`. `.zarr` directories work when
   dragged from the OS file manager (the browser unpacks the directory).
2. Click **Load** in the top bar and pick a file.
3. Pass a URL via `?file=<url>`. The app fetches the content and infers
   the format from the filename.

If the file is a trajectory, the **Timeline** appears under the canvas.
Scrub through frames or press `Space` to toggle playback.

## Modes

MolVis separates user interaction into five modes. Only one is active at
a time. The right sidebar updates to show controls for the current mode.

### View (`1`)

The default. The canvas orbits, pans, and zooms; no clicks on atoms do
anything. The View sidebar has three tabs:

- **Render** — representation (ball-and-stick, spacefill, stick), atom
  and bond diameters, simulation box wireframe color and thickness.
- **Pipeline** — the modifier pipeline (see below).
- **Inspect** — per-atom data for the atom under the cursor.

Changes in the Render tab are immediate; there is no *Apply* button.

### Select (`2`)

Click atoms or bonds to add them to the selection. Hold `Shift` to
extend, `Ctrl/Cmd` to toggle, `Alt` to deselect. Drag a box to select by
region.

The Select sidebar additionally offers:

- An **expression** selection field. The syntax mirrors VMD:
  `element C and x > 10` picks every carbon with `x` above 10 Å.
- **Invert**, **Clear**, **Select all**.
- A live count of selected atoms and bonds at the bottom.

### Edit (`3`)

Edit mode is a **staging** session: any add/delete/move you make writes
to an *edit pool* layered on top of the current frame. The pool is only
committed back to the frame when you leave the mode, so you can
experiment without destroying the trajectory.

Controls:

- **Builder** tab — type a SMILES string or a PubChem CID/name and press
  *Place*, then click on the canvas to drop the molecule.
- **Tools** tab — add/delete atoms, add bonds, delete bonds.
- **Download Structure** — fetch a PDB entry by accession code.

Right-clicking an atom or bond in Edit mode deletes it from the staged
pool. Pressing `Ctrl/Cmd+S` syncs the staged changes into the frame
immediately. Leaving Edit mode with uncommitted changes prompts you to
*Keep* or *Discard* them.

### Manipulate (`4`)

With atoms selected, Manipulate mode shows translate / rotate / scale
gizmos pinned to the selection centroid. The selection moves as a rigid
group; neighboring atoms are untouched.

### Measure (`5`)

Click atoms to place measurement anchors:

- 2 atoms → **distance**, rendered as a labeled line.
- 3 atoms → **angle**, rendered as an arc.
- 4 atoms → **dihedral**, rendered as a ribbon.

Each measurement is a pipeline item you can delete later from the
Measure sidebar.

## The modifier pipeline

The **Pipeline** tab (View mode, right sidebar) is the single place
where frame data is transformed before rendering. Each entry is a
**modifier** that reads the output of the previous one and produces a
new frame:

```
raw frame → DataSource → Slice → ExpressionSelect → ColorByProperty → canvas
```

Modifiers you can add:

| Modifier | Purpose |
|---|---|
| Data source | Switch which trajectory slice feeds the pipeline |
| Slice | Keep atoms inside a user-defined plane |
| Expression select | VMD-style predicate to mark atoms for downstream modifiers |
| Hide selection | Drop selected atoms from the render |
| Transparent selection | Render selection with alpha |
| Color by property | Map a column (`charge`, `mass`, …) to a color ramp |
| Assign color | Force a fixed color on selected atoms |
| Wrap PBC | Wrap atoms into the primary cell |

Drag items to re-order, click the eye icon to mute a modifier without
deleting it, and click the trash icon to delete. All pipeline changes
are commands: `Ctrl+Z` undoes them.

## Rendering and export

From the **top bar**:

- **Screenshot** — opens the OVITO-style dialog. Choose resolution, DPI,
  optional frame border, and crop. Preview updates live. Press *Save*
  to download a PNG.
- **Export** — dumps the current pipeline output to XYZ.
- **Settings** — camera speeds, graphics toggles (FXAA, hardware
  scaling), grid options.
- **Theme** — light / dark toggle. The canvas background and grid
  colors follow the theme.

## Keyboard cheatsheet

| Key | Action |
|-----|--------|
| `1`–`5` | Switch mode |
| `Space` | Play / pause trajectory |
| `←` `→` | Step one frame |
| `F` | Fit camera to current frame |
| `G` | Toggle grid |
| `B` | Toggle simulation box |
| `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` | Undo / redo |
| `Ctrl/Cmd+S` | Save (export or flush edit pool, depending on mode) |
| `?` | Keyboard shortcuts dialog |
