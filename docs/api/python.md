# Python API Reference

The `molvis` Python package bundles the same MolVis engine as an
[anywidget](https://anywidget.dev/) that works in Jupyter, VSCode's
Jupyter extension, and JupyterLab, plus a standalone window mode for
scripts.

## Install

```bash
pip install molvis
```

```python
import molvis as mv
```

Requires Python 3.11+. The JS bundle is shipped inside the wheel; no
separate frontend installation is needed.

## Two usage modes

### Jupyter widget — `mv.Molvis`

In a notebook cell, the widget is the last expression:

```python
import molvis as mv
import molpy as mp

scene = mv.Molvis(name="demo", session="shared-demo")
scene.draw_frame(mp.Frame(...))
scene
```

Numeric arrays round-trip as binary buffers, not JSON, so you can push
million-atom frames without blowing up the kernel ↔ frontend message
size.

### Standalone window — `mv.show`

Outside a notebook — for example in a Python script or a REPL — call
`mv.show()`. It serves the same React app from a local HTTP server and
opens your default browser.

```python
import molvis as mv

scene = mv.show(mode="app")   # full UI
scene.draw_frame(frame)
scene.close()
```

`mode="core"` drops the React chrome and shows only the 3D canvas.

## `Molvis` (widget)

### Constructor

```python
mv.Molvis(
    name: str = "<generated>",
    session: str | None = None,
    width: int = 800,
    height: int = 600,
    **anywidget_kwargs,
)
```

- **`name`** — registry key for `Molvis.get_scene(name)`. Defaults to a
  NATO-alphabet string (`alpha`, `bravo`, …).
- **`session`** — shared frontend session. Two widgets with the same
  `session` share one Babylon.js engine and scene state, so selections
  and view changes are mirrored between notebook cells.
- **`width`, `height`** — iframe size in pixels.

### Drawing

```python
scene.draw_frame(frame)                 # render a single frame
scene.draw_trajectory(frames)           # render a list of frames
scene.set_frame(index)                  # jump to a frame in a trajectory
```

`frame` is a `molpy.Frame`. MolVis converts it to a `molrs` frame
internally.

### Commands

Every MolVis command is callable from Python:

```python
scene.send_cmd("draw_frame", frame=frame)
scene.send_cmd("set_mode", mode="select")
scene.send_cmd("undo")
scene.send_cmd("apply_pipeline", pipeline=[...])
```

Responses come back as normal Python values. If the command fails in
the frontend, a `mv.MolvisRpcError` is raised with the frontend stack
trace.

### Registry

```python
mv.Molvis.list_scenes()          # -> ['demo', 'alpha', ...]
mv.Molvis.get_scene("demo")      # -> existing Molvis
mv.Molvis.clear_all()            # dispose every registered widget
```

`list_scenes` returns the names registered in **this kernel**;
`clear_all` disposes every widget and clears the registry.

### Closing

```python
scene.close()
```

Tears down the frontend session and removes the widget from the registry.
Sessions survive individual widget closes — as long as one widget with a
given `session` is alive, the shared scene persists.

### Error handling

Frontend exceptions surface as `mv.MolvisRpcError`:

```python
from molvis import MolvisRpcError

try:
    scene.send_cmd("add_modifier", kind="nope")
except MolvisRpcError as exc:
    print(exc.code, exc.message)
```

### Shared sessions

```python
primary   = mv.Molvis(name="primary",   session="protein")
secondary = mv.Molvis(name="secondary", session="protein")

# primary.draw_frame(frame) updates both cells
```

The first widget to attach to a session creates the engine; subsequent
widgets attach as additional views. When the last widget closes, the
engine is torn down.

## `show()` and `StandaloneMolvis`

```python
mv.show(
    frame=None,          # optional initial frame
    mode="app",          # "app" or "core"
    host="127.0.0.1",
    port=0,              # 0 = pick a free port
    open_browser=True,
)
```

Returns a `StandaloneMolvis` that implements the same `send_cmd` and
`draw_frame` surface as `Molvis`, plus:

```python
standalone = mv.show()
standalone.show(block=False)       # returns immediately
standalone.close()

with mv.show() as scene:           # context manager form
    scene.draw_frame(frame)
```

`block=True` (the default for `show()` without the context manager)
keeps the Python process alive until the browser tab closes.

## Transport internals

Python ↔ frontend communication is JSON-RPC 2.0 over either
`anywidget`'s custom message channel or a WebSocket (for standalone
mode). Dense numeric arrays travel as binary buffers attached to the
RPC message, not as JSON arrays.

If you need a custom transport (e.g. to drive MolVis from a remote
process), subclass `molvis.transport_base.Transport` and pass an
instance to `Molvis(transport=...)`.

## Worked example

```python
import molpy as mp
import molvis as mv

# build a simple water molecule
frame = mp.Frame(
    elements=["O", "H", "H"],
    positions=[(0, 0, 0), (0.9572, 0, 0), (-0.2399, 0.9266, 0)],
)

scene = mv.Molvis(name="water", width=600, height=400)
scene.draw_frame(frame)
scene.send_cmd("set_mode", mode="select")
scene
```

Run the cell, switch the viewport to Select mode, click the oxygen,
then back in Python:

```python
scene.send_cmd("get_selection")
# -> {"atoms": [0], "bonds": []}
```
