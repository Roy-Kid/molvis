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
scene = mv.Molvis(name="demo", width=800, height=600)
scene
```

Constructor arguments:

- `name`: optional registry key used by `Molvis.get_scene(name)`
- `width`: widget width in pixels
- `height`: widget height in pixels
- `**kwargs`: forwarded to `anywidget.AnyWidget`

## Drawing

```python
scene.new_frame(name=None, clear=True)
scene.draw_frame(frame, style="ball_and_stick")
scene.draw_atomistic(atomistic, style="spacefill")
scene.draw_box(box, color="#4b5563", line_width=1.0, visible=True)
```

`draw_frame(...)` expects a `molpy.Frame` with an `atoms` block. If the atom coordinates are stored as `xyz`, MolVis normalizes them to `x/y/z` before sending them to the frontend.

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

## Registry And Lifecycle

```python
mv.Molvis.get_scene("demo")
mv.Molvis.list_scenes()
mv.Molvis.get_instance_count()
mv.Molvis.get_frontend_instance_count()
scene.close()
```

- `get_scene(name)` returns a named widget or raises `KeyError`.
- `list_scenes()` returns currently registered names.
- `get_instance_count()` reports Python-side live widget objects.
- `get_frontend_instance_count()` reports live frontend widget instances via RPC.
- `close()` removes the widget from the registry and clears the current scene.

## Packaging Note

The wheel and sdist expect the frontend bundle at `python/src/molvis/dist/index.js`. Run `npm run build -w python` before `python -m build --no-isolation python`.
