# Molvis (Jupyter Widget)

Interactive 3D molecular visualization inside Jupyter notebooks, powered by [anywidget](https://anywidget.dev/).

## Constructor

``` python
scene = mv.Molvis(
    name: str = "",
    session: str = "",
    width: int = 800,
    height: int = 600,
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `str` | `""` | Scene name for retrieval via `Molvis.get_scene()` |
| `session` | `str` | `""` | Session key. Multiple handles with the same session share one 3D engine. |
| `width` | `int` | `800` | Widget width in pixels |
| `height` | `int` | `600` | Widget height in pixels |

## Display

Return the widget object at the end of a cell to render it:

``` python
scene = mv.Molvis(name="demo")
scene.draw_frame(frame)
scene  # renders inline
```

## Scene management

### `Molvis.get_scene(name)`

Retrieve a previously created scene by name.

``` python
scene = mv.Molvis.get_scene("protein_view")
```

### `Molvis.list_scenes()`

List all named scenes.

``` python
names = mv.Molvis.list_scenes()  # ["structure1", "structure2"]
```

### `scene.close()`

Close a scene and release its resources.

## Shared sessions

Multiple widget handles pointing at the same BabylonJS engine:

``` python
main = mv.Molvis(name="main", session="protein")
mirror = mv.Molvis(name="mirror", session="protein")

main.draw_frame(frame)   # both widgets update
```

Only one output cell is active at a time. Clicking "Activate session here" in another cell re-attaches the live canvas.

## Drawing commands

`Molvis` shares the same [drawing commands](commands.md) as `StandaloneMolvis`:

``` python
scene.draw_frame(frame, style="ball_and_stick")
scene.draw_box(box)
scene.clear()
scene.set_style(style="spacefill")
scene.set_theme("modern")
scene.snapshot()
scene.export_frame()
scene.get_selected()
scene.select_atom_by_id([0, 2])
```

## Binary transport

Numeric numpy arrays are automatically sent as binary buffer attachments via anywidget's comm channel, avoiding JSON expansion of large coordinate arrays.
