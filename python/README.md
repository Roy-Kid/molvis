# molvis

Python package for MolVis molecular visualization. Works in two modes:

- **Standalone** -- `mv.show(frame)` opens a browser window from any Python script
- **Jupyter** -- `mv.Molvis()` renders an interactive widget inline in notebooks

## Installation

```bash
pip install molvis
```

## Quick Start (Jupyter)

```python
import numpy as np
import molpy as mp
import molvis as mv

frame = mp.Frame(blocks={
    "atoms": {
        "x": np.array([0.0, -0.757, 0.757], dtype=np.float32),
        "y": np.array([0.0, 0.586, 0.586], dtype=np.float32),
        "z": np.array([0.0, 0.0, 0.0], dtype=np.float32),
        "element": ["O", "H", "H"],
    },
    "bonds": {
        "i": np.array([0, 0], dtype=np.uint32),
        "j": np.array([1, 2], dtype=np.uint32),
    },
})

# One line -- draws and displays the widget
mv.Molvis().draw_frame(frame)
```

## Standalone Viewer

```python
import molvis as mv

mv.show(frame)                  # canvas only, blocks until closed
mv.show(frame, mode="page")    # full UI with sidebars

viewer = mv.show(frame, block=False)   # non-blocking
viewer.set_style(style="spacefill")
viewer.close()
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `frame` | `mp.Frame \| None` | `None` | Frame to display immediately |
| `mode` | `"core" \| "page"` | `"core"` | `"core"` = canvas only; `"page"` = full UI |
| `block` | `bool` | `True` | Block until browser tab is closed |
| `width` | `int` | `1200` | Viewer width in pixels |
| `height` | `int` | `800` | Viewer height in pixels |

## Scene Management

Every `Molvis()` widget is a **scene**. Each scene has a **name** and belongs
to a **session**.

### Default scene

`mv.Molvis()` without a name always returns the same **default** scene.
Calling it again is a no-op — you get the existing instance back:

```python
a = mv.Molvis()
b = mv.Molvis()
assert a is b          # True — same object
```

### Named scenes

Use explicit names when you need multiple independent canvases:

```python
protein = mv.Molvis(name="protein")
ligand  = mv.Molvis(name="ligand")

print(protein)  # Molvis(name='protein', session='protein', 800x600)
```

Re-creating a scene with the same name closes the old one automatically:

```python
s = mv.Molvis(name="protein")   # closes previous "protein" if any
```

### Scene registry

Retrieve any scene by name from anywhere in the notebook:

```python
mv.Molvis.list_scenes()        # ['Alpha', 'Bravo', 'protein', 'ligand']
mv.Molvis.get_scene("protein") # returns the Molvis instance
scene.close()                  # remove from registry
```

### Shared canvas

By default each scene gets its own independent 3D engine. To share a single
engine across multiple cells, give them the same `session` key:

```python
# Cell 1
main = mv.Molvis(name="main", session="shared")
main.draw_frame(frame)

# Cell 2
alt = mv.Molvis(name="alt", session="shared")
alt   # shows "Activate scene alt" button
```

**How it works:**

- Only one cell shows the live 3D canvas at a time.
- Inactive cells display a small **Activate scene _name_** button.
- Clicking the button moves the live canvas to that cell.
- All cells sharing a session share state: drawing, camera, selection.

### Cleanup

```python
mv.Molvis.scene_count()          # number of live scenes on the frontend
mv.Molvis.clear_all()            # dispose every live scene
mv.Molvis.clear_all_content()    # clear 3D content but keep canvases
```

## Drawing API

All mutation commands return `self` for chaining and inline display:

```python
scene = mv.Molvis()
scene.draw_frame(frame, style="ball_and_stick")  # displays widget

# Further commands on an existing scene
scene.draw_box(box)
scene.draw_atoms(atoms, style="spacefill")
scene.draw_atomistic(molecule)
scene.new_frame()
scene.set_style(style="spacefill", atom_radius=0.5)
scene.set_theme("modern")       # "classic" | "modern"
scene.clear()
```

### Query commands

These block until the frontend responds:

```python
png_bytes = scene.snapshot()          # PNG screenshot
frame = scene.export_frame()          # read back current frame data
selected = scene.get_selected()       # selected atoms as mp.Frame
scene.select_atom_by_id([0, 2])
```

## Palette Utilities

Palette helpers are available as Molvis commands and return the runtime's
actual palette definitions:

```python
import molvis as mv
from IPython.display import Image

scene = mv.Molvis()
scene  # display first so the frontend session is ready

scene.list_palettes()
scene.palette_entries("cpk")[:5]
scene.palette_colors("glasbey-vivid")[:8]

png = scene.palette_preview("glasbey-vivid")
Image(data=png)

scene.save_palette_preview("glasbey-vivid", "glasbey-vivid.png")
```

### Error handling

Frontend errors from fire-and-forget commands (like `draw_frame`) are
printed to stderr in the notebook cell output.  Query commands raise
`MolvisRpcError` directly:

```python
try:
    scene.export_frame()
except mv.MolvisRpcError as exc:
    print(exc.code, exc)
```

## Development

```bash
cd python && npm run build        # build Jupyter widget bundle
python -m pytest tests/ -v        # run tests
```

## Packaging

```bash
cd python
npm run build
python -m build --wheel
```
