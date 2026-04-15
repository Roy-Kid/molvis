# StandaloneMolvis

Class for the standalone browser-based viewer. Created by [`mv.show()`](show.md) or directly.

## Constructor

``` python
viewer = mv.StandaloneMolvis(
    mode: "core" | "page" = "core",
    width: int = 1200,
    height: int = 800,
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `mode` | `"core" \| "page"` | `"core"` | Viewer mode |
| `width` | `int` | `1200` | Width in pixels |
| `height` | `int` | `800` | Height in pixels |

## Methods

### `show(block=True)`

Open the viewer in the default browser.

``` python
viewer = mv.StandaloneMolvis(mode="core")
viewer.show(block=False)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `block` | `bool` | `True` | Block until browser tab is closed |

Returns `self` for method chaining.

### `close()`

Stop the server and clean up. Safe to call multiple times.

``` python
viewer.close()
```

### `send_cmd(method, params, ...)`

Low-level RPC dispatch to the browser. Normally you use the higher-level drawing commands instead.

``` python
resp = viewer.send_cmd(
    "draw_frame",
    {"frameData": frame.to_dict()},
    wait_for_response=True,
    timeout=10.0,
)
```

## Drawing commands

`StandaloneMolvis` inherits all [drawing commands](commands.md):

``` python
viewer.draw_frame(frame, style="ball_and_stick")
viewer.draw_box(box)
viewer.clear()
viewer.set_style(style="spacefill", atom_radius=0.5)
viewer.set_theme("modern")
viewer.snapshot()
viewer.export_frame()
viewer.get_selected()
viewer.select_atom_by_id([0, 2])
```

## Context manager

``` python
with mv.StandaloneMolvis(mode="page") as viewer:
    viewer.show(block=False)
    viewer.draw_frame(frame)
    viewer.set_style(style="spacefill")
    # server stops on __exit__
```

## Architecture

```
Python process                          Browser
+-----------------------+               +-----------------------+
| StandaloneMolvis      |               | Page App (React)      |
|   +- MolvisServer     |  HTTP static  |   +- MolvisApp        |
|   |   +- static files +-------------->|   +- WebSocketBridge   |
|   |   +- /ws endpoint |  WebSocket    |       +- RpcRouter     |
|   +- WsTransport      |<============>|                        |
+-----------------------+               +-----------------------+
```

The server runs in a daemon thread. Commands are serialized as JSON-RPC 2.0 with binary buffer attachments for numpy arrays (zero-copy transport).
