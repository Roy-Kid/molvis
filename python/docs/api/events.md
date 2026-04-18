# Events & State

Canvas interactions (selection, mode switches, frame navigation) flow
back to Python through JSON-RPC notifications (`id`-less messages)
over the same WebSocket that carries commands in the other direction.
Python keeps a local cache of the pushed state; callbacks let you react
to changes without polling.

## The event catalogue

| Event | Params | Cache field |
|-------|--------|-------------|
| `selection_changed` | `{atom_ids, bond_ids}` | `viewer.selection` |
| `mode_changed` | `{mode}` | `viewer.current_mode` |
| `frame_changed` | `{index, total}` | `viewer.current_frame`, `viewer.n_frames` |
| `status_message` | `{text, type}` | — |
| `hello_state` *(initial snapshot)* | `{selection, mode, frame_index, total_frames}` | bulk-update |

Internally the frontend `EventForwarder` (`page/src/lib/event-forwarder.ts`)
subscribes to core `EventEmitter` signals and pushes them here.

## Subscribing

``` python
viewer = mv.Molvis()

# Returns an EventHandle; callback fires on the WS thread.
handle = viewer.on("selection_changed",
                   lambda ev: print("atoms:", ev["atom_ids"]))

# Unsubscribe when you are done.
handle.remove()
```

## Blocking wait

``` python
ev = viewer.wait_for("selection_changed", timeout=30)

# With a predicate — only resolve when the user selects at least 3 atoms
ev = viewer.wait_for(
    "selection_changed",
    timeout=60,
    predicate=lambda e: len(e.get("atom_ids", [])) >= 3,
)
```

`wait_for` raises `TimeoutError` if the event never fires within
`timeout` seconds.

## Cached state

``` python
viewer.selection         # Selection(atom_ids=(...), bond_ids=(...))
viewer.current_mode      # "view" | "select" | "edit" | "measure" | "manipulate"
viewer.current_frame     # int
viewer.n_frames          # int
```

These are cheap properties — they read the local `ViewerState` cache
that gets updated every time the frontend pushes a notification. No
RPC roundtrip is involved.

If you suspect drift (e.g. you mutated selection out-of-band and want
to double-check), force a roundtrip:

``` python
snapshot = viewer.refresh_state()     # → state.get RPC, primes cache
```

## Threading notes

Callbacks registered via `on()` run on the transport's asyncio thread,
not the main Python thread. Rules of thumb:

* Short, idempotent handlers are fine in callbacks.
* Avoid calling back into `viewer.send_cmd(…, wait_for_response=True)`
  from a callback — you will deadlock the transport thread.
* If you need to pipe events into a main-thread consumer, hand them off
  via a `queue.Queue` and drain it from your main loop.
* For synchronous workflows (drive the canvas, wait for a selection,
  continue) prefer `viewer.wait_for(...)` which is main-thread safe.
