# Transport

`Molvis` communicates with the page bundle over a local WebSocket. The
transport layer is deliberately thin — a single class —
so adding new hosts (popup windows, VSCode webviews, …) only requires
a thin adapter, never a parallel business-logic implementation.

## Default behavior

``` python
viewer = mv.Molvis()
```

under the hood creates:

``` python
mv.WebSocketTransport(
    page_base_url=None,             # serve bundled page on the same port
    host="localhost",
    port=0,                         # OS picks a free port
    token=None,                     # random 24-byte URL-safe string
    open_browser=not _in_jupyter_kernel(),
    event_bus=viewer.events,        # wired by Molvis
    minimal=False,                  # True ⇒ hide all overlays (gui=False)
)
```

- `page_base_url=None` → the transport serves `page_dist/` from its
  own HTTP port. In Jupyter the cell loader fetches the bundle's
  `<script>` and `<link>` URLs from this same port and mounts the
  app inline; in a script the browser opens the page URL.
- Token is embedded in the page URL as `?token=...` and validated on
  the handshake; mismatched tokens close the WebSocket with code 1008.

## Explicit construction

### CDN-hosted page

``` python
viewer = mv.Molvis(transport=mv.WebSocketTransport(
    page_base_url="https://molvis.dev/app",   # external static host
    port=8765,
))
```

Modern browsers treat `localhost` as a "potentially trustworthy" origin,
so an HTTPS page on `molvis.dev` can connect to a `ws://localhost:8765`
endpoint without mixed-content blocking.

### Fixed port + pre-shared token

``` python
mv.WebSocketTransport(
    port=9000,
    token="my-shared-secret",
    open_browser=False,
)
```

Useful when the browser is driven by another tool (Selenium, automated
tests) that needs to know the URL ahead of time.

### Canvas-only (no chrome)

``` python
viewer = mv.Molvis(gui=False)
```

Equivalent to passing `minimal=True` to `WebSocketTransport`: the
standalone URL is tagged with `&minimal=1`, and in Jupyter the inline
mount opts carry `{minimal: true}`. The page bundle then skips `TopBar`,
the left / right sidebars, and the timeline — only the 3D canvas is
drawn. Useful when the Python side supplies its own UI on top of the
viewer, or for screenshot / embedding workflows.

## Handshake

    client → server   {"type":"hello", "token":"…", "session":"…"}
    server → client   {"type":"ready"}                 (✓ success)
                      ws.close(1008, "auth")            (✗ token mismatch)

After `ready`, JSON-RPC 2.0 begins in both directions:

- **Requests** (`id` present): the transport sends commands; the page
  returns responses in the same envelope.
- **Notifications** (no `id`): the page pushes events; they arrive at
  the attached [`EventBus`](events.md).

Binary attachments (numpy arrays, PNG snapshots) travel alongside JSON
in a single binary frame; see `molvis.transport._codec` for the
wire format.

## Lifecycle

``` python
transport = mv.WebSocketTransport()
transport.start()                    # spawn background asyncio loop
transport.wait_for_connection()      # block until browser handshakes (no timeout)
# ... normal operation ...
transport.stop()                     # tear down cleanly
```

When you use `mv.Molvis()` the lifecycle is managed for you —
`start()` runs on first `send_cmd` or `_repr_mimebundle_`; `close()`
calls `stop()`.
