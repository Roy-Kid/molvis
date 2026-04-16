# Python Widget API Reference

## Package

```bash
pip install molvis
```

```python
import molvis as mv
```

## Entry Point

### `Molvis`

`Molvis` is the Jupyter widget class exported by `molvis`.

```python
scene = mv.Molvis(name="demo", session="shared-demo", width=800, height=600)
scene
```

Constructor arguments:

- `name`: optional registry key used by `Molvis.get_scene(name)`
- `session`: optional shared frontend session key; widgets with the same session share scene state and a single Babylon.js engine
- `width`: widget width in pixels
- `height`: widget height in pixels
- `**kwargs`: forwarded to `anywidget.AnyWidget`

## Error Model

State-changing widget commands use JSON-RPC acknowledgements. Frontend-side validation failures and MolVis runtime exceptions are propagated back into Python as `mv.MolvisRpcError`.

```python
try:
    scene.draw_frame(frame)
except mv.MolvisRpcError as exc:
    print(exc.code)
    print(exc)
```

`MolvisRpcError` exposes:

- `method`: frontend JSON-RPC method name, for example `scene.draw_frame`
- `code`: JSON-RPC error code such as `-32602` or `-32603`
- `data`: optional structured payload returned by the frontend
- `request_id`: JSON-RPC request id when available

## Binary Transport

Numeric NumPy arrays are serialized into anywidget binary buffers automatically. String/object arrays still fall back to JSON. This is how large `atoms.x/y/z`, bond indices, and other dense numeric blocks are sent without turning them into huge JSON lists.

## Drawing

```python
scene.new_frame(name=None, clear=True)
scene.draw_frame(frame, style="ball_and_stick")
scene.draw_atomistic(atomistic, style="spacefill")
scene.draw_box(box, color="#4b5563", line_width=1.0, visible=True)
```

`draw_frame(...)` expects a `molpy.Frame` with an `atoms` block. If the atom coordinates are stored as `xyz`, MolVis normalizes them to `x/y/z` before sending them to the frontend.

All state-changing drawing commands wait for an acknowledgement from the frontend and can raise `mv.MolvisRpcError` if validation or rendering fails.

## Selection And Export

```python
selected = scene.get_selected(timeout=5.0)
exported = scene.export_frame(timeout=5.0)
png_bytes = scene.snapshot(timeout=5.0)
scene.select_atom_by_id([1, 4, 7])
```

- `get_selected()` returns a `molpy.Frame` containing the selected `atoms` and `bonds` blocks.
- `export_frame()` returns the current staged scene as a `molpy.Frame`.
- `snapshot()` returns PNG bytes from the current canvas.
- `select_atom_by_id(...)` validates and applies selection on the frontend, and raises `mv.MolvisRpcError` on frontend failure.

## Registry And Lifecycle

```python
mv.Molvis.get_scene("demo")
mv.Molvis.list_scenes()
mv.Molvis.get_instance_count()
mv.Molvis.get_frontend_instance_count()
mv.Molvis.list_frontend_sessions()
scene.close()
```

- `get_scene(name)` returns a named widget or raises `KeyError`.
- `list_scenes()` returns currently registered names.
- `get_instance_count()` reports Python-side live widget objects.
- `get_frontend_instance_count()` reports live shared frontend sessions via RPC.
- `list_frontend_sessions()` lists live frontend session keys.
- `close()` removes only the Python widget handle from the registry; it does not clear a shared frontend session.

## Shared Session Semantics

Two widgets with the same `session` share frontend state:

```python
left = mv.Molvis(name="left", session="protein")
right = mv.Molvis(name="right", session="protein")
```

- Drawing into either handle updates the same frontend scene.
- A shared session owns one Babylon.js engine.
- If both widgets are displayed, only one cell is active at a time; activating the other cell re-attaches the live session there.

## Packaging Note

The wheel and sdist expect the frontend bundle at `python/src/molvis/dist/index.js`. Run `npm run build -w python` before `python -m build --no-isolation python`.
