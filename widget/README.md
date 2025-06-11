# Molvis Jupyter Widget

`molvis` provides a small Jupyter widget for interactive molecular visualisation.  The widget acts as a thin wrapper around the TypeScript viewer contained in this repository.  Data is transferred from Python to the frontend using HDF5 binary buffers.

## Installation

```
pip install .[dev]
```

To develop the frontend assets you can run `npm run dev -w widget` from the repository root.

## Usage

```python
import molpy as mp
import molvis as mv

# build a simple molecule using molpy
water = mp.builder.water.tip3p
frame = water.to_frame()

# create the widget and draw the frame
viewer = mv.Molvis(width=600, height=400)
viewer.draw_frame(frame)
viewer
```

`draw_frame` serialises the atom and bond tables of `mp.Frame` using HDF5 and sends the resulting binary buffers to the frontend where they are reconstructed into JavaScript objects.  Individual atoms can also be added using `draw_atom`.  Bonds can be drawn directly with `draw_bond`, and a complete `mp.Struct` can be visualised using `draw_struct` which internally converts the structure to a frame and forwards it to `draw_frame`.

