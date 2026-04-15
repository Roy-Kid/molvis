#!/usr/bin/env python3
"""
Core Molvis scene class for Jupyter widget integration.
"""

from __future__ import annotations

import json
import logging
import os
import pathlib
import weakref
from importlib.resources import files
from typing import Any

import anywidget
import traitlets

from .commands import (
    DrawingCommandsMixin,
    FrameCommandsMixin,
    FrontendCommands,
    OverlayCommandsMixin,
    PaletteCommandsMixin,
    SelectionCommandsMixin,
    SnapshotCommandsMixin,
)
from .errors import MolvisRpcError
from .transport import RpcTransport

logger = logging.getLogger("molvis")

__all__ = ["Molvis"]

NATO_ALPHABET = (
    "Alpha",
    "Bravo",
    "Charlie",
    "Delta",
    "Echo",
    "Foxtrot",
    "Golf",
    "Hotel",
    "India",
    "Juliet",
    "Kilo",
    "Lima",
    "Mike",
    "November",
    "Oscar",
    "Papa",
    "Quebec",
    "Romeo",
    "Sierra",
    "Tango",
    "Uniform",
    "Victor",
    "Whiskey",
    "X-ray",
    "Yankee",
    "Zulu",
)

_nato_counter = 0


def _next_nato_name(registry: dict[str, object]) -> str:
    """Return the next unused NATO phonetic name."""
    global _nato_counter
    suffix = ""
    while True:
        for name in NATO_ALPHABET:
            candidate = f"{name}{suffix}"
            if candidate not in registry:
                _nato_counter += 1
                return candidate
        suffix = f"-{_nato_counter // len(NATO_ALPHABET) + 1}"


def resolve_esm_path() -> pathlib.Path:
    """
    Resolve the bundled frontend module for the widget.

    `MOLVIS_ESM_PATH` can be used to override the location for local development
    or packaging diagnostics. Otherwise the path is resolved from the installed
    `molvis` package resources.
    """
    override = os.environ.get("MOLVIS_ESM_PATH")
    if override:
        esm_path = pathlib.Path(override).expanduser().resolve()
    else:
        esm_resource = files("molvis").joinpath("dist").joinpath("index.js")
        esm_path = pathlib.Path(str(esm_resource))

    if not esm_path.exists():
        logger.warning(
            "Molvis frontend bundle not found at %s. "
            "Build it with `npm run build -w python` before using the widget.",
            esm_path,
        )

    return esm_path


class Molvis(
    anywidget.AnyWidget,
    DrawingCommandsMixin,
    SelectionCommandsMixin,
    FrameCommandsMixin,
    SnapshotCommandsMixin,
    OverlayCommandsMixin,
    PaletteCommandsMixin,
):
    """
    A widget for molecular visualization using molpy and anywidget.

    This widget provides an interactive 3D molecular visualization interface
    that can display molecular structures, atoms, bonds, and frames.

    The Python handle is decoupled from the frontend runtime:

    - Dense numeric arrays are serialized through anywidget binary buffers.
    - Multiple widget handles can share a frontend ``session`` across notebook cells.
    - A shared session owns a single Babylon.js engine and live scene state.
    - Frontend JSON-RPC errors are raised in Python as ``MolvisRpcError``.

    Examples:
        >>> import molvis as mv
        >>> import molpy as mp
        >>>
        >>> # Create a named scene
        >>> scene = mv.Molvis(
        ...     name="protein_view",
        ...     session="protein_session",
        ...     width=800,
        ...     height=600,
        ... )
        >>>
        >>> # Draw a frame
        >>> frame = mp.Frame(...)
        >>> scene.draw_frame(frame)
        >>>
        >>> # Retrieve scene by name
        >>> scene = mv.Molvis.get_scene("protein_view")
        >>>
        >>> # Display the widget
        >>> scene
    """

    # Traitlets for anywidget sync
    name: str = traitlets.Unicode("").tag(sync=True)
    width: int = traitlets.Int(800).tag(sync=True)
    height: int = traitlets.Int(600).tag(sync=True)
    background: str = traitlets.Unicode("").tag(sync=True)
    ready: bool = traitlets.Bool(False).tag(sync=True)
    _last_error: str = traitlets.Unicode("").tag(sync=True)

    # Class-level scene registry (by name)
    _scene_registry: dict[str, "Molvis"] = {}

    # Class variable to track all widget instances
    _instances: weakref.WeakSet["Molvis"] = weakref.WeakSet()

    _esm = resolve_esm_path()

    _DEFAULT_NAME = "default"

    def __new__(
        cls,
        name: str | None = None,
        width: int = 800,
        height: int = 600,
        background: str = "",
        **kwargs: Any,
    ) -> "Molvis":
        scene_name = name or cls._DEFAULT_NAME
        existing = cls._scene_registry.get(scene_name)
        if existing is not None:
            return existing
        return super().__new__(cls)

    def __init__(
        self,
        name: str | None = None,
        width: int = 800,
        height: int = 600,
        background: str = "",
        **kwargs: Any,
    ) -> None:
        # Already initialised (returned from __new__ via registry hit).
        if getattr(self, "_initialised", False):
            return
        self._initialised = True

        scene_name = name or self._DEFAULT_NAME

        super().__init__(
            name=scene_name, width=width, height=height, background=background, **kwargs
        )

        Molvis._scene_registry[scene_name] = self
        Molvis._instances.add(self)
        self._transport = RpcTransport(self)

        self.observe(self._on_ready_changed, names=["ready"])
        self.observe(self._on_error_changed, names=["_last_error"])

        logger.debug("Molvis scene '%s' created", scene_name)

    def __repr__(self) -> str:
        return f"Molvis(name={self.name!r}, {self.width}x{self.height})"

    # -------------------------------------------------------------------------
    # Scene Registry Methods
    # -------------------------------------------------------------------------

    @classmethod
    def get_scene(cls, name: str) -> "Molvis":
        """
        Retrieve a scene by name.

        Args:
            name: The name of the scene to retrieve

        Returns:
            The Molvis instance with the given name

        Raises:
            KeyError: If no scene with the given name exists
        """
        if name not in cls._scene_registry:
            available = list(cls._scene_registry.keys())
            raise KeyError(f"Scene '{name}' not found. Available scenes: {available}")
        return cls._scene_registry[name]

    @classmethod
    def list_scenes(cls) -> list[str]:
        """
        List all registered scene names.

        Returns:
            A list of scene names
        """
        return list(cls._scene_registry.keys())

    @classmethod
    def get_instance_count(cls) -> int:
        """Get the current number of Python widget instances."""
        return len(cls._instances)

    @classmethod
    def list_instances(cls) -> list["Molvis"]:
        """Get a list of all current Python widget instances."""
        return list(cls._instances)

    def close(self) -> None:
        """
        Close this widget handle and remove it from the Python registry.

        Closing a widget does not clear the shared frontend session because
        other cells or widget handles may still be attached to it.
        """
        if self.name in Molvis._scene_registry:
            del Molvis._scene_registry[self.name]

        close_super = getattr(super(), "close", None)
        if callable(close_super):
            close_super()

        logger.debug(f"Molvis scene '{self.name}' closed")

    # -------------------------------------------------------------------------
    # Communication Methods
    # -------------------------------------------------------------------------

    def send_cmd(
        self,
        method: str,
        params: dict[str, Any],
        buffers: list[Any] | None = None,
        wait_for_response: bool = False,
        timeout: float = 10.0,
    ) -> Any:
        """
        Send a command to the frontend.

        Args:
            method: RPC method name
            params: Method parameters
            buffers: Optional binary buffers appended after automatically
                encoded numeric ndarray payloads.
            wait_for_response: If True, block until the response arrives and
                raise on error.  Use True for queries that return data.
                Fire-and-forget commands should leave this False -- errors
                are logged asynchronously via :meth:`_handle_custom_msg`.
            timeout: Maximum time to wait for response (seconds).

        Returns:
            ``self`` when *wait_for_response* is False (for chaining).
            The ``result`` field of the JSON-RPC response otherwise.

        Raises:
            TimeoutError: If no response arrives within *timeout* seconds.
            MolvisRpcError: If the frontend returns a JSON-RPC error response.
        """
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
            raise MolvisRpcError(
                method=method,
                code=int(error.get("code", -32603)),
                message=str(error.get("message", "Unknown frontend error")),
                data=error.get("data"),
                request_id=response.get("id"),
            )
        if isinstance(response, dict) and "result" in response:
            return response["result"]
        return response

    def _handle_custom_msg(
        self, content: bytes | dict[str, Any], buffers: list[Any]
    ) -> None:
        """Handle custom messages from frontend."""
        delivered = self._transport.handle_response(content, buffers)
        if delivered:
            return
        # Fire-and-forget response with no waiter.
        # Decode bytes if needed to inspect for errors.
        decoded: Any = content
        if isinstance(content, (bytes, bytearray)):
            try:
                decoded = json.loads(content)
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass
        if isinstance(decoded, dict) and "error" in decoded:
            err = decoded.get("error") or {}
            logger.error("Frontend error: %s", err.get("message", "Unknown error"))

    def _on_ready_changed(self, change: dict[str, Any]) -> None:
        """Handle ready state changes."""
        if change.get("new"):
            logger.debug(f"Scene '{self.name}' is ready")

    def _on_error_changed(self, change: dict[str, Any]) -> None:
        """Surface frontend errors via logger."""
        msg = change.get("new", "")
        if msg:
            logger.error("Frontend error: %s", msg)
            self._last_error = ""

    # -------------------------------------------------------------------------
    # Frontend Scene Management
    # -------------------------------------------------------------------------

    @classmethod
    def scene_count(cls) -> int:
        """Number of live scenes on the frontend."""
        try:
            instances = list(cls._instances)
            if not instances:
                return 0
            result = instances[0].send_cmd(
                FrontendCommands.SESSION_COUNT.method,
                {},
                wait_for_response=True,
            )
            return result if isinstance(result, int) else 0
        except Exception:
            return 0

    @classmethod
    def clear_all(cls) -> None:
        """Dispose every live frontend scene."""
        try:
            instances = list(cls._instances)
            if not instances:
                return
            instances[0].send_cmd(FrontendCommands.CLEAR_ALL_SESSIONS.method, {})
        except Exception:
            pass

    @classmethod
    def clear_all_content(cls) -> None:
        """Clear 3D content from every live scene but keep the canvases."""
        try:
            instances = list(cls._instances)
            if not instances:
                return
            instances[0].send_cmd(FrontendCommands.CLEAR_ALL_CONTENT.method, {})
        except Exception:
            pass
