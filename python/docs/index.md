# MolVis

MolVis is a Python package for interactive 3D molecular visualization. It works in two modes:

- **Standalone** -- one function call opens a browser viewer, like `matplotlib.pyplot.show()`
- **Jupyter** -- inline interactive widget in notebooks

## Installation

``` bash
pip install molvis
```

## Hello, molecule

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

mv.show(frame)  # (1)!
```

1. Opens your default browser and renders the molecule. Blocks until the tab is closed.

## Two modes at a glance

=== "Standalone (script / CLI)"

    ``` python
    import molvis as mv

    mv.show(frame)                    # canvas only
    mv.show(frame, mode="page")       # full UI
    ```

=== "Jupyter notebook"

    ``` python
    import molvis as mv

    scene = mv.Molvis(name="demo")
    scene.draw_frame(frame)
    scene  # renders inline
    ```
