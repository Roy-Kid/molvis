"""
:class:`Molvis` is the one user-facing viewer class.

A :class:`Molvis` instance owns a :class:`~molvis.transport.Transport`
and drives the shared frontend (page bundle) over JSON-RPC 2.0 + binary
buffers. The same class works from three host contexts:

* **Plain Python script** — ``mv.Molvis()`` starts a local WebSocket
  server, opens the page in the default browser, and returns. Commands
  block on the handshake the first time they fire.
* **Jupyter cell** — ``scene = mv.Molvis(); scene`` displays the page
  inline in the cell output by loading the page bundle's hashed
  ``<script>`` tags into ``document.head``, then calling
  ``window.MolvisApp.mount(cell_div, opts)`` against a fresh Shadow DOM
  root so the page's Tailwind preflight does not leak into the
  notebook. The script then dials back to the same Python-hosted
  WebSocket. No iframe, no anywidget, no traitlets.
* **Explicit CDN** — pass
  ``transport=mv.WebSocketTransport(page_base_url="…")`` to point the
  page at an externally-hosted bundle.

All host logic lives in the transport; ``Molvis`` is transport-agnostic.
"""

from __future__ import annotations

import html
import json
import logging
import secrets
import threading
import time
import weakref
from typing import TYPE_CHECKING, Any, Final, Iterable

import molpy as mp

from .commands import (
    DrawingCommandsMixin,
    FrameCommandsMixin,
    ModifierInfo,
    OverlayCommandsMixin,
    PaletteCommandsMixin,
    PipelineCommandsMixin,
    SelectionCommandsMixin,
    SnapshotCommandsMixin,
)
from .errors import MolvisRPCError
from .events import EventBus, EventHandle, Selection, ViewerState
from .transport import Transport, WebSocketTransport
from .transport._jupyter_env import in_jupyter_kernel as _in_jupyter_kernel

if TYPE_CHECKING:
    from collections.abc import Callable

    from .transport import PageEndpoints

logger = logging.getLogger("molvis")

__all__ = ["Molvis"]


class _Unset:
    """Sentinel for parameters the caller did not pass."""

    _singleton: "_Unset | None" = None

    def __new__(cls) -> "_Unset":
        if cls._singleton is None:
            cls._singleton = super().__new__(cls)
        return cls._singleton

    def __repr__(self) -> str:
        return "<unset>"

    def __bool__(self) -> bool:
        return False


_UNSET: Final[_Unset] = _Unset()


class Molvis(
    DrawingCommandsMixin,
    SelectionCommandsMixin,
    FrameCommandsMixin,
    SnapshotCommandsMixin,
    OverlayCommandsMixin,
    PaletteCommandsMixin,
    PipelineCommandsMixin,
):
    """A MolVis viewer driven by JSON-RPC over WebSocket.

    Parameters
    ----------
    name
        Human-readable session name. Instantiating twice with the same
        name returns the cached instance — but only when the requested
        config is compatible. Passing a different ``gui``, ``width``,
        ``height``, or ``transport`` than the cached scene raises
        :class:`ValueError`. Use :meth:`replace` to swap the cached
        scene for a new configuration, or pass a different ``name``.
    transport
        A :class:`~molvis.transport.Transport` implementation. When
        ``None``, a :class:`~molvis.transport.WebSocketTransport` is
        created with ``open_browser`` set to ``True`` outside Jupyter
        and ``False`` inside a notebook kernel.
    width, height
        Cell-host viewport size in CSS pixels (notebook) and a default
        sizing hint for the standalone host.
    gui
        When ``True`` (default), render the full page shell
        (TopBar / LeftSidebar / RightSidebar / TimelineControl) on top
        of the 3D canvas. Set to ``False`` to hide every overlay and
        render only the canvas — useful for embedding the viewer as a
        pure display surface driven entirely from Python.

    Example
    -------
        >>> import molvis as mv
        >>> viewer = mv.Molvis()                          # full UI
        >>> canvas = mv.Molvis(name="bare", gui=False)    # canvas only
        >>> viewer.draw_frame(frame)
        >>> viewer.on("selection_changed",
        ...           lambda ev: print(ev["atom_ids"]))
        >>> viewer.selection
        Selection(atom_ids=(), bond_ids=())

        # The two viewers above share the same Python process but each
        # owns its own port, transport, and browser session — they are
        # *not* aliased even though one used the implicit "default" name.
        >>> mv.Molvis(gui=False)            # raises: cached gui=True
        Traceback (most recent call last):
        ValueError: Molvis(name='default') already exists ...
        >>> mv.Molvis.replace(gui=False)    # close and recreate
    """

    _scene_registry: dict[str, "Molvis"] = {}
    _instances: weakref.WeakSet["Molvis"] = weakref.WeakSet()
    _DEFAULT_NAME = "default"

    def __new__(
        cls,
        name: str | None = None,
        *,
        transport: Transport | None = None,
        width: int | _Unset = _UNSET,
        height: int | _Unset = _UNSET,
        gui: bool | _Unset = _UNSET,
    ) -> "Molvis":
        scene_name = name or cls._DEFAULT_NAME
        existing = cls._scene_registry.get(scene_name)
        if existing is None:
            return super().__new__(cls)

        existing._reject_param_conflict(
            transport=transport, width=width, height=height, gui=gui
        )
        return existing

    def __init__(
        self,
        name: str | None = None,
        *,
        transport: Transport | None = None,
        width: int | _Unset = _UNSET,
        height: int | _Unset = _UNSET,
        gui: bool | _Unset = _UNSET,
    ) -> None:
        if getattr(self, "_initialised", False):
            return
        self._initialised = True

        self.name: str = name or self._DEFAULT_NAME
        self.width: int = 1200 if isinstance(width, _Unset) else width
        self.height: int = 800 if isinstance(height, _Unset) else height
        self.gui: bool = True if isinstance(gui, _Unset) else gui
        self._created_at: float = time.time()

        self._state = ViewerState()
        self._events = EventBus(self._state)

        if transport is None:
            transport = WebSocketTransport(
                open_browser=not _in_jupyter_kernel(),
                event_bus=self._events,
                minimal=not self.gui,
            )
        else:
            attach = getattr(transport, "attach_event_bus", None)
            if callable(attach):
                attach(self._events)

        self._transport: Transport = transport

        # Mirror of what this scene has pushed to the frontend. On a new
        # WS handshake the frontend sends `event.request_state_sync` and
        # we reply with a `scene.apply_state` RPC carrying this snapshot
        # so the reloaded page can rebuild the same pipeline/scene the
        # old page had. Updated only from the pipeline + drawing mixins.
        self._mirror_pipeline: list[ModifierInfo] = []
        self._mirror_trajectory: list[mp.Frame] | None = None
        self._mirror_boxes: list[mp.Box | None] | None = None
        self._mirror_lock = threading.Lock()

        self._events.on(
            "request_state_sync", self._handle_state_sync_request
        )

        Molvis._scene_registry[self.name] = self
        Molvis._instances.add(self)
        logger.debug(
            "Molvis '%s' created (gui=%s, %dx%d)",
            self.name,
            self.gui,
            self.width,
            self.height,
        )

    def __repr__(self) -> str:
        status = "connected" if self.connected else "idle"
        return (
            f"Molvis(name={self.name!r}, {self.width}x{self.height}, "
            f"gui={self.gui}, {status})"
        )

    def _reject_param_conflict(
        self,
        *,
        transport: Transport | None,
        width: int | _Unset,
        height: int | _Unset,
        gui: bool | _Unset,
    ) -> None:
        """Raise if the cached scene does not match the requested config.

        We only validate parameters the caller passed explicitly — omitted
        kwargs are treated as "give me whatever is cached".
        """
        if transport is not None and transport is not self._transport:
            raise ValueError(
                f"Molvis(name={self.name!r}) already exists with a "
                "different transport; refusing to attach a new one. "
                f"Use Molvis.replace({self.name!r}, transport=...) to "
                f"swap, or Molvis.get_scene({self.name!r}) to fetch the "
                "existing one."
            )
        mismatches: list[str] = []
        if not isinstance(gui, _Unset) and gui != self.gui:
            mismatches.append(f"gui: cached={self.gui!r}, requested={gui!r}")
        if not isinstance(width, _Unset) and width != self.width:
            mismatches.append(
                f"width: cached={self.width!r}, requested={width!r}"
            )
        if not isinstance(height, _Unset) and height != self.height:
            mismatches.append(
                f"height: cached={self.height!r}, requested={height!r}"
            )
        if not mismatches:
            return
        details = "\n  ".join(mismatches)
        raise ValueError(
            f"Molvis(name={self.name!r}) already exists with a different "
            f"configuration:\n  {details}\n"
            "Choose one of:\n"
            f"  - pass a different name=  to open a new viewer\n"
            f"  - Molvis.replace({self.name!r}, ...)  to close & recreate\n"
            f"  - Molvis.get_scene({self.name!r})     to fetch the existing one"
        )

    # ------------------------------------------------------------------
    # Registry
    # ------------------------------------------------------------------

    @classmethod
    def get_scene(cls, name: str) -> "Molvis":
        try:
            return cls._scene_registry[name]
        except KeyError as exc:
            available = list(cls._scene_registry.keys())
            raise KeyError(
                f"Scene '{name}' not found. Available scenes: {available}"
            ) from exc

    @classmethod
    def list_scenes(cls) -> list[str]:
        return list(cls._scene_registry.keys())

    @classmethod
    def get_instance_count(cls) -> int:
        return len(cls._instances)

    @classmethod
    def list_instances(cls) -> list["Molvis"]:
        return list(cls._instances)

    @classmethod
    def has_scene(cls, name: str) -> bool:
        """Return ``True`` when a scene with this *name* is registered."""
        return name in cls._scene_registry

    @classmethod
    def replace(cls, name: str | None = None, **kwargs: Any) -> "Molvis":
        """Close any existing scene with this name and create a new one.

        Use this when you want to change ``gui``, ``width``, ``height``,
        or the ``transport`` of an already-running viewer — those cannot
        be mutated in place because the transport URL and the page mount
        opts are baked in at construction time.
        """
        scene_name = name or cls._DEFAULT_NAME
        existing = cls._scene_registry.get(scene_name)
        if existing is not None:
            existing.close()
        return cls(name=scene_name, **kwargs)

    @classmethod
    def close_all(cls) -> None:
        """Close every registered scene and clear the registry."""
        for scene in list(cls._scene_registry.values()):
            try:
                scene.close()
            except Exception:
                logger.exception("Failed to close scene '%s'", scene.name)
        cls._scene_registry.clear()

    @classmethod
    def session_summary(cls) -> list[dict[str, Any]]:
        """Return one dict per registered scene for debugging / display."""
        return [scene.session_info for scene in cls._scene_registry.values()]

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Stop the transport and drop this instance from the registry."""
        stop = getattr(self._transport, "stop", None)
        if callable(stop):
            try:
                stop()
            except Exception:
                logger.exception("Transport.stop raised for '%s'", self.name)
        Molvis._scene_registry.pop(self.name, None)
        self._initialised = False
        logger.debug("Molvis '%s' closed", self.name)

    @property
    def connected(self) -> bool:
        """Whether the transport currently holds a live browser session."""
        return bool(getattr(self._transport, "connected", False))

    @property
    def session_info(self) -> dict[str, Any]:
        """Snapshot of viewer identity and connection state."""
        port = getattr(self._transport, "port", 0)
        return {
            "name": self.name,
            "gui": self.gui,
            "width": self.width,
            "height": self.height,
            "connected": self.connected,
            "port": port,
            "created_at": self._created_at,
        }

    def _ensure_started(self) -> None:
        start = getattr(self._transport, "start", None)
        if callable(start):
            start()

    # ------------------------------------------------------------------
    # Command channel (used by every command mixin)
    # ------------------------------------------------------------------

    def send_cmd(
        self,
        method: str,
        params: dict[str, Any],
        buffers: list[Any] | None = None,
        wait_for_response: bool = False,
        timeout: float = 10.0,
    ) -> Any:
        """Send a JSON-RPC request to the frontend.

        Raises
        ------
        TimeoutError
            The transport never received a response.
        MolvisRPCError
            The frontend returned an error envelope.
        """
        self._ensure_started()
        response = self._transport.send_request(
            method,
            params,
            buffers=buffers,
            wait_for_response=wait_for_response,
            timeout=timeout,
        )
        if not wait_for_response:
            return self
        if isinstance(response, dict) and "error" in response:
            error = response["error"] or {}
            logger.error(
                "RPC error on '%s': [%s] %s",
                method,
                error.get("code", -32603),
                error.get("message", "Unknown frontend error"),
            )
            raise MolvisRPCError(
                method=method,
                code=int(error.get("code", -32603)),
                message=str(error.get("message", "Unknown frontend error")),
                data=error.get("data"),
                request_id=response.get("id"),
            )
        if isinstance(response, dict) and "result" in response:
            return response["result"]
        return response

    # ------------------------------------------------------------------
    # Events + cached state (see molvis.events)
    # ------------------------------------------------------------------

    def on(
        self,
        event: str,
        callback: "Callable[[dict[str, Any]], None]",
    ) -> EventHandle:
        """Subscribe to a frontend event. See :class:`~molvis.events.EventBus`."""
        return self._events.on(event, callback)

    def wait_for(
        self,
        event: str,
        *,
        timeout: float = 30.0,
        predicate: "Callable[[dict[str, Any]], bool] | None" = None,
    ) -> dict[str, Any]:
        """Block until an event matching *event* (and *predicate*) fires."""
        return self._events.wait_for(
            event, timeout=timeout, predicate=predicate
        )

    def refresh_state(self, *, timeout: float = 10.0) -> ViewerState:
        """Force a roundtrip to rebuild the local cache from the canvas."""
        snapshot = self.send_cmd(
            "state.get", {}, wait_for_response=True, timeout=timeout
        )
        if isinstance(snapshot, dict):
            self._events.prime_state(snapshot)
        return self._events.snapshot()

    @property
    def selection(self) -> Selection:
        return self._state.selection

    @property
    def current_mode(self) -> str:
        return self._state.mode

    @property
    def current_frame(self) -> int:
        return self._state.frame_index

    @property
    def n_frames(self) -> int:
        return self._state.total_frames

    @property
    def events(self) -> EventBus:
        return self._events

    # ------------------------------------------------------------------
    # Mirror state (for reconnect replay)
    # ------------------------------------------------------------------

    def _record_pipeline(self, entries: Iterable[ModifierInfo]) -> None:
        """Replace the pipeline mirror with ``entries`` (frontend order)."""
        with self._mirror_lock:
            self._mirror_pipeline = list(entries)

    def _record_trajectory(
        self,
        frames: Iterable[mp.Frame],
        boxes: Iterable[mp.Box | None] | None,
    ) -> None:
        """Cache what we just handed to :meth:`draw_frame` / :meth:`set_trajectory`.

        Keeps frames and boxes as live objects; ``_build_state_payload``
        re-serializes on demand when the frontend asks for sync.
        """
        with self._mirror_lock:
            self._mirror_trajectory = list(frames)
            if boxes is None:
                self._mirror_boxes = None
            else:
                self._mirror_boxes = list(boxes)

    def _clear_mirror(self) -> None:
        """Drop everything — called from ``clear()`` / ``clear_pipeline()``."""
        with self._mirror_lock:
            self._mirror_pipeline = []
            self._mirror_trajectory = None
            self._mirror_boxes = None

    def _build_state_payload(self) -> dict[str, Any]:
        """Serialize mirror state for a ``scene.apply_state`` RPC."""
        with self._mirror_lock:
            pipeline = [
                {
                    "id": m.id,
                    "name": m.name,
                    "category": m.category,
                    "enabled": m.enabled,
                    "parent_id": m.parent_id,
                }
                for m in self._mirror_pipeline
            ]
            frames: list[dict[str, Any]] | None = None
            if self._mirror_trajectory is not None:
                frames = [
                    {"blocks": f.to_dict().get("blocks", {})}
                    for f in self._mirror_trajectory
                ]
            boxes: list[dict[str, Any] | None] | None = None
            if self._mirror_boxes is not None:
                boxes = [
                    b.to_dict() if b is not None else None
                    for b in self._mirror_boxes
                ]
        return {
            "pipeline": pipeline,
            "frames": frames,
            "boxes": boxes,
        }

    def _handle_state_sync_request(self, params: dict[str, Any]) -> None:
        """Fire-and-forget reply to ``event.request_state_sync``.

        The EventBus dispatches on the transport's asyncio thread, so we
        offload the actual send to a daemon thread — ``send_request``
        uses ``future.result()`` which would deadlock if called from the
        loop thread.
        """
        threading.Thread(
            target=self._send_state_sync_snapshot,
            name=f"molvis-state-sync-{self.name}",
            daemon=True,
        ).start()

    def _send_state_sync_snapshot(self) -> None:
        try:
            payload = self._build_state_payload()
            self._transport.send_request(
                "scene.apply_state",
                payload,
                wait_for_response=False,
            )
        except Exception:
            logger.exception("Failed to send state sync to frontend")

    # ------------------------------------------------------------------
    # Jupyter rich display — inline mount via the page bundle's ESM
    # ------------------------------------------------------------------

    def _repr_mimebundle_(
        self,
        include: Iterable[str] | None = None,
        exclude: Iterable[str] | None = None,
        **_kwargs: Any,
    ) -> dict[str, Any]:
        """Return a Jupyter mimebundle that mounts the viewer in-cell.

        Returns a multi-MIME bundle that lets the notebook frontend pick
        the richest representation it understands, mirroring Plotly's
        approach:

        - ``text/html`` — a ``<div>`` plus a ``<script>`` that loads the
          page bundle and calls ``window.MolvisApp.mount(el, opts)``
          against a Shadow DOM root for style isolation.
        - ``text/plain`` — a short text fallback for nbviewer / GitHub.

        Use ``include`` / ``exclude`` (matching ``IPython.display``
        conventions) to filter which MIME types are returned.
        """
        bundle: dict[str, Any] = {"text/plain": repr(self)}

        endpoints_fn = getattr(self._transport, "page_endpoints", None)
        if callable(endpoints_fn):
            self._ensure_started()
            endpoints = endpoints_fn(session=self.name)
            bundle["text/html"] = self._render_inline_mount(endpoints)

        if include is not None:
            keep = set(include)
            bundle = {k: v for k, v in bundle.items() if k in keep}
        if exclude is not None:
            drop = set(exclude)
            bundle = {k: v for k, v in bundle.items() if k not in drop}
        return bundle

    def _render_inline_mount(self, endpoints: "PageEndpoints") -> str:
        """Build the cell HTML — a div + a loader script."""
        nonce = secrets.token_hex(4)
        cell_id = f"molvis-cell-{nonce}"
        opts = {
            "wsUrl": endpoints.ws_url,
            "token": endpoints.token,
            "session": endpoints.session,
            "useShadowDOM": True,
            "cssUrls": list(endpoints.css),
            "theme": "dark",
            "minimal": not self.gui,
        }
        loader = _BOOTSTRAP_LOADER.format(
            cell_id=json.dumps(cell_id),
            asset_base=json.dumps(endpoints.base_url),
            scripts=json.dumps(list(endpoints.scripts)),
            opts=json.dumps(opts),
        )
        cell_id_attr = html.escape(cell_id, quote=True)
        return (
            f'<div id="{cell_id_attr}" class="molvis-cell" '
            f'style="width:{int(self.width)}px;height:{int(self.height)}px;'
            f'display:block"></div>'
            f"<script>{loader}</script>"
        )


# ---------------------------------------------------------------------------
# Inline embedding bootstrap (executes inside the notebook page)
# ---------------------------------------------------------------------------

# A self-contained IIFE that loads the page bundle's chunked scripts in
# order, then calls ``window.MolvisApp.mount(el, opts)``. Multiple cells
# share a global load promise so each chunk is fetched once per page.
#
# The entry chunk uses top-level await (the @molcrafts/molrs WASM module
# is an async ESM), so ``<script>.onload`` fires before
# ``window.MolvisApp`` is actually assigned. We therefore poll briefly
# after the network load completes.
_BOOTSTRAP_LOADER = """\
(function() {{
  var cellId = {cell_id};
  var assetBase = {asset_base};
  var scripts = {scripts};
  var opts = {opts};
  var APP_READY_TIMEOUT_MS = 15000;
  // Tell the bundle's webpack runtime where to fetch async chunks + WASM.
  // Without this, document-relative URLs resolve against the webview origin
  // (e.g. vscode-webview://…) and the kernel's static routes return 401.
  if (assetBase) {{ window.__MOLVIS_ASSET_BASE__ = assetBase; }}
  function loadScript(src) {{
    return new Promise(function(resolve, reject) {{
      var existing = document.querySelector('script[data-molvis="' + src + '"]');
      if (existing) {{
        if (existing.dataset.molvisLoaded === "true") {{ resolve(); return; }}
        existing.addEventListener("load", function() {{ resolve(); }});
        existing.addEventListener("error", function() {{
          reject(new Error("Failed to load " + src));
        }});
        return;
      }}
      var s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.dataset.molvis = src;
      s.addEventListener("load", function() {{
        s.dataset.molvisLoaded = "true";
        resolve();
      }});
      s.addEventListener("error", function() {{
        reject(new Error("Failed to load " + src));
      }});
      document.head.appendChild(s);
    }});
  }}
  function ensureLoaded() {{
    // Already mounted in this page (another cell got there first).
    if (window.MolvisApp && typeof window.MolvisApp.mount === "function") {{
      return Promise.resolve();
    }}
    // Cache per-script-set so a fresh build / fresh port does not reuse
    // a stale (often failed) promise from a previous kernel.
    var key = scripts.join("|");
    var cache = window.__molvisLoadPromises || (window.__molvisLoadPromises = {{}});
    if (cache[key]) return cache[key];
    var p = Promise.resolve();
    scripts.forEach(function(src) {{
      p = p.then(function() {{ return loadScript(src); }});
    }});
    // Drop the entry on failure so the next mount attempt can retry.
    cache[key] = p.catch(function(err) {{
      delete cache[key];
      throw err;
    }});
    return cache[key];
  }}
  function waitForApp(timeoutMs) {{
    return new Promise(function(resolve, reject) {{
      var deadline = Date.now() + timeoutMs;
      (function check() {{
        if (window.MolvisApp && typeof window.MolvisApp.mount === "function") {{
          resolve();
          return;
        }}
        if (Date.now() >= deadline) {{
          reject(new Error(
            "window.MolvisApp.mount not available within " + timeoutMs + "ms"
          ));
          return;
        }}
        setTimeout(check, 30);
      }})();
    }});
  }}
  function mount() {{
    var el = document.getElementById(cellId);
    if (!el) return;
    try {{ window.MolvisApp.mount(el, opts); }}
    catch (err) {{
      el.textContent = "Failed to mount MolVis: " + (err && err.message ? err.message : err);
    }}
  }}
  ensureLoaded()
    .then(function() {{ return waitForApp(APP_READY_TIMEOUT_MS); }})
    .then(mount)
    .catch(function(err) {{
      var el = document.getElementById(cellId);
      if (el) el.textContent = "Failed to bootstrap MolVis: " + (err && err.message ? err.message : err);
    }});
}})();
"""
