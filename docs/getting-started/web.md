# Web viewer

The MolVis web viewer lives at
[**molvis.molcrafts.org**](https://molvis.molcrafts.org). No install is
needed — open the URL in any modern browser (Chrome, Firefox, Safari,
Edge) and the viewer is ready.

![The viewer: left sidebar with analysis tools, the canvas in the center, the right sidebar with mode controls](../assets/viewport.png)

The window has three panels:

- **Left sidebar** — analysis tools (clusters, radial distribution,
  data inspector) and layer toggles.
- **Center** — the 3D viewport, with a trajectory timeline underneath
  when a multi-frame file is loaded.
- **Right sidebar** — controls for the active mode.

The side panels are collapsible: drag the dividers or double-click
them to hide a side and maximize the viewport.

## Loading a structure

Three ways to load a file:

1. **Drag and drop** a file anywhere on the page. Supported
   extensions: `.pdb`, `.xyz`, `.data`, `.dump`, `.lammpstrj`, and
   `.zarr` directories (drag the whole directory from your OS file
   manager).
2. Click **Load** in the top bar and pick a file.
3. Pass a URL via `?file=<url>`. MolVis fetches the content and
   infers the format from the filename. This is the easy way to share
   a structure: send the collaborator a prepared link.

Examples:

- `molvis.molcrafts.org/?file=https://files.rcsb.org/download/1TQN.pdb`
  opens a cytochrome directly from the PDB.
- `molvis.molcrafts.org/?minimal=1` hides every piece of UI chrome and
  leaves only the canvas — useful when embedding MolVis as an iframe.

If the file is a trajectory, the **Timeline** appears below the
viewport. Scrub through frames or press `Space` to toggle playback.

## Modes

MolVis separates interaction into five modes. Exactly one is active at
a time; the right sidebar shows controls for whichever mode is
current.

### View (`1`)

The default. The viewport orbits, pans, and zooms; clicks don't do
anything to the atoms. The View sidebar has three tabs:

- **Render** — representation (ball-and-stick, spacefill, stick),
  atom and bond diameters, simulation box wireframe color and
  thickness. All changes are immediate — no *Apply* button.
- **Pipeline** — the modifier pipeline (see below).
- **Inspect** — per-atom data for the atom under the cursor.

### Select (`2`)

Click atoms or bonds to add them to the selection. Hold **Shift** to
extend, **Ctrl/Cmd** to toggle, **Alt** to deselect. Drag a rectangle
to select by region.

The Select sidebar adds:

- An **expression** field. The syntax mirrors VMD:
  `element C and x > 10` picks every carbon with `x` above 10 Å.
- **Invert**, **Clear**, **Select all** shortcuts.
- A live count of selected atoms and bonds at the bottom.

### Edit (`3`)

Edit mode is a **staging** session: any add / delete / move you make
writes to an *edit pool* layered on top of the current frame. The
pool is only committed back to the frame when you leave the mode, so
you can experiment without destroying the trajectory.

![Edit mode → Builder tab: SMILES input with a 2D preview](../assets/edit-builder.png)

Controls:

- **Builder** tab — type a SMILES string or a PubChem CID/name and
  press *Place*, then click on the canvas to drop the molecule.
- **Tools** tab — add atoms, delete atoms, add bonds, delete bonds.
- **Download Structure** — fetch a PDB entry by accession code
  (e.g. `1TQN`).

Right-clicking an atom or bond deletes it from the staged pool.
Pressing **Ctrl/Cmd+S** flushes the pool into the frame immediately.
Leaving Edit mode with uncommitted changes prompts you to *Keep* or
*Discard*.

### Manipulate (`4`)

With atoms selected, Manipulate mode shows translate / rotate / scale
gizmos pinned to the selection centroid. The selection moves as a
rigid group; neighboring atoms stay put.

### Measure (`5`)

Click atoms to place measurement anchors:

- 2 atoms → **distance**, rendered as a labeled line.
- 3 atoms → **angle**, rendered as an arc.
- 4 atoms → **dihedral**, rendered as a ribbon.

![Measure mode with distance, angle, and dihedral annotations on a small molecule](../assets/measure.png)

Each measurement is a first-class pipeline entry; you can delete it
later from the Measure sidebar.

## The pipeline

The **Pipeline** tab (View mode, right sidebar) is the single place
where frame data is transformed before rendering. Each entry is a
**modifier** that reads the output of the previous one and produces
a new frame:

```
raw frame → DataSource → Slice → ExpressionSelect → ColorByProperty → rendered
```

![The pipeline panel with a DataSource, Slice, ExpressionSelect, and ColorByProperty stacked](../assets/pipeline.png)

Available modifiers:

| Modifier | Purpose |
|---|---|
| Data source | Switch which trajectory slice feeds the pipeline. |
| Slice | Keep atoms inside a user-defined plane. |
| Expression select | VMD-style predicate to mark atoms for downstream modifiers. |
| Hide selection | Drop selected atoms from the render. |
| Transparent selection | Render the selection with alpha. |
| Color by property | Map a column (`charge`, `mass`, …) to a color ramp. |
| Assign color | Force a fixed color on selected atoms. |
| Wrap PBC | Wrap atoms into the primary cell. |

Drag entries to re-order, click the eye icon to mute without
deleting, and click the trash icon to delete. All pipeline changes
are commands — **Ctrl/Cmd+Z** undoes them.

## Rendering and export

From the **top bar**:

- **Screenshot** — opens the dialog. Choose resolution, DPI, optional
  frame border, and crop. The preview updates live.

  ![Screenshot dialog: live preview on the left, controls on the right](../assets/screenshot-dialog.png)

- **Export** — dumps the current pipeline output to XYZ.
- **Settings** — camera speeds, graphics toggles (FXAA, hardware
  scaling), grid options.
- **Theme** — light / dark toggle. Canvas background and grid colors
  follow the theme.

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
| `Ctrl/Cmd+S` | Save (export or flush the edit pool, depending on mode) |
| `?` | Show this cheatsheet |
