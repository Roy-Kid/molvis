# Python SDK Reference

The `molvis` package provides the Jupyter widget integration.

## `class Molvis`

The main widget class that represents a 3D scene.

### Constructor

```python
Molvis(name: str | None = None, width: int = 800, height: int = 600, **kwargs)
```

*   **name** *(str, optional)*: A unique name for the scene. If not provided, a UUID-based name is generated.
*   **width** *(int)*: Width of the widget in pixels. Default is 800.
*   **height** *(int)*: Height of the widget in pixels. Default is 600.

### Static Methods

#### `get_scene(name: str) -> Molvis`

Retrieves a previously created scene by its name. Raises `KeyError` if not found.

#### `list_scenes() -> list[str]`

Returns a list of all registered scene names.

### Instance Methods

#### `draw_frame(frame, options=None)`

Draws a molecular frame into the scene.

*   **frame**: A `molpy.Frame` object (or compatible structure).
*   **options** *(dict, optional)*: Rendering options.

#### `select(atom_indices: list[int])`

Highlights the specified atoms in the viewer.

*   **atom_indices**: A list of integer indices corresponding to the atoms in the current frame.

#### `close()`

Closes the widget and removes it from the global registry.

#### `send_cmd(method: str, params: dict, wait_for_response=False)`

Sends a low-level JSON-RPC command to the frontend.

*   **method**: The name of the command (e.g., "set_background").
*   **params**: A dictionary of parameters.
*   **wait_for_response**: If `True`, blocks until the frontend replies.
