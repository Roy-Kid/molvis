# mv.show()

The top-level convenience function for quick visualization.

``` python
import molvis as mv

viewer = mv.show(frame)
```

## Signature

``` python
def show(
    frame: mp.Frame | None = None,
    *,
    mode: "core" | "page" = "core",
    block: bool = True,
    width: int = 1200,
    height: int = 800,
) -> StandaloneMolvis
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `frame` | `mp.Frame \| None` | `None` | Frame to display immediately. If `None`, the viewer opens empty. |
| `mode` | `"core" \| "page"` | `"core"` | `"core"` = canvas only (fast); `"page"` = full UI with sidebars, timeline, analysis |
| `block` | `bool` | `True` | If `True`, block until browser tab is closed. If `False`, return immediately. |
| `width` | `int` | `1200` | Viewer width in pixels |
| `height` | `int` | `800` | Viewer height in pixels |

## Returns

A [`StandaloneMolvis`](standalone.md) instance. In non-blocking mode, use it to send additional commands.

## How it works

1. Starts a local HTTP + WebSocket server (auto-assigned port)
2. Opens the default browser at `http://localhost:{port}?ws=1`
3. Waits for the browser to connect and signal readiness
4. Sends the frame data over WebSocket (JSON-RPC + binary buffers)
5. If `block=True`, waits until the browser tab is closed
6. Cleans up the server on exit

## Examples

### Quick view

``` python
mv.show(frame)  # opens browser, blocks until closed
```

### Non-blocking with commands

``` python
viewer = mv.show(frame, block=False)
viewer.set_style(style="spacefill")
viewer.set_theme("modern")
viewer.close()
```

### Full UI mode

``` python
mv.show(frame, mode="page")
```

### Empty viewer

``` python
viewer = mv.show(block=False)
viewer.draw_frame(frame1)
# ... later
viewer.draw_frame(frame2)
viewer.close()
```
