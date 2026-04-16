# Quick Start

## Standalone viewer

The fastest path from data to 3D visualization.

### Blocking mode (default)

``` python
import molvis as mv
import molpy as mp
import numpy as np

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

mv.show(frame)
```

The call blocks until you close the browser tab -- just like `matplotlib.pyplot.show()`.

### Non-blocking mode

``` python
viewer = mv.show(frame, block=False)

viewer.set_style(style="spacefill")
viewer.set_theme("modern")
snap = viewer.snapshot()  # PNG bytes

viewer.close()
```

### Viewer modes

| Mode | URL param | What you see |
|------|-----------|--------------|
| `"core"` (default) | `?ws=1&minimal=1` | Canvas only -- fast, clean |
| `"page"` | `?ws=1` | Full UI: sidebars, timeline, analysis tools |

``` python
mv.show(frame)                    # canvas only
mv.show(frame, mode="page")       # full UI
```

### Context manager

``` python
with mv.StandaloneMolvis(mode="core") as viewer:
    viewer.show(block=False)
    viewer.draw_frame(frame)
    viewer.set_style(style="spacefill")
    # server stops automatically on exit
```

## Jupyter widget

``` python
import molvis as mv
import molpy as mp

scene = mv.Molvis(name="protein_view", width=800, height=600)
scene.draw_frame(frame, style="ball_and_stick")
scene  # display inline
```

### Shared sessions

Multiple cells sharing one 3D engine:

``` python
main = mv.Molvis(name="main", session="shared")
mirror = mv.Molvis(name="mirror", session="shared")

# draw in one cell, view in another
main.draw_frame(frame)
```

## Drawing a simulation box

``` python
import molpy as mp

box = mp.Box.ortho(
    lengths=[10.0, 10.0, 10.0],
    origin=[0.0, 0.0, 0.0],
    pbc_x=True, pbc_y=True, pbc_z=True,
)

viewer = mv.show(frame, block=False)
viewer.draw_box(box)
```
