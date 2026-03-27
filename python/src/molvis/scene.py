#!/usr/bin/env python3
"""
Core Molvis scene class for Jupyter widget integration.
"""

from __future__ import annotations

import json
import logging
import os
import pathlib
import uuid
import weakref
from importlib.resources import files
from typing import Any

import anywidget
import traitlets

from .commands import (
    DrawingCommandsMixin,
    FrameCommandsMixin,
    FrontendCommands,
    SelectionCommandsMixin,
    SnapshotCommandsMixin,
)
from .errors import MolvisRpcError
from .transport import RpcTransport

logger = logging.getLogger("molvis")

__all__ = ["Molvis"]


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


class Molvis(anywidget.AnyWidget, DrawingCommandsMixin, SelectionCommandsMixin, FrameCommandsMixin, SnapshotCommandsMixin):
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
    session: str = traitlets.Unicode("").tag(sync=True)
    width: int = traitlets.Int(800).tag(sync=True)
    height: int = traitlets.Int(600).tag(sync=True)
    session_id: int = traitlets.Int().tag(sync=True)
    ready: bool = traitlets.Bool(False).tag(sync=True)

    # Class-level scene registry (by name)
    _scene_registry: dict[str, "Molvis"] = {}
    
    # Class variable to track all widget instances
    _instances: weakref.WeakSet["Molvis"] = weakref.WeakSet()

    _esm = resolve_esm_path()

    def __init__(
        self, 
        name: str | None = None, 
        session: str | None = None,
        width: int = 800, 
        height: int = 600, 
        **kwargs: Any
    ) -> None:
        """
        Create a new Molvis visualization scene.
        
        Args:
            name: Optional name for the scene. If not provided, a unique name is generated.
            session: Optional shared frontend session key. Widgets with the same
                session share scene state and one Babylon.js engine.
            width: Width of the widget in pixels.
            height: Height of the widget in pixels.
            **kwargs: Additional keyword arguments passed to anywidget.
        """
        # Generate unique session ID
        session_id = abs(hash(uuid.uuid4().hex)) % (2**31 - 1)
        
        # Generate name if not provided
        scene_name = name or f"scene_{session_id}"
        session_name = session or scene_name
        
        super().__init__(
            name=scene_name,
            session=session_name,
            width=width,
            height=height,
            session_id=session_id,
            **kwargs
        )
        
        # Register in scene registry
        Molvis._scene_registry[scene_name] = self
        Molvis._instances.add(self)
        self._transport = RpcTransport(self)
        
        # Add observer for ready state changes
        self.observe(self._on_ready_changed, names=['ready'])
        
        logger.debug(f"Molvis scene '{scene_name}' created")

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
        timeout: float = 5.0
    ) -> "Molvis" | dict[str, Any]:
        """
        Send a command to the frontend.
        
        Args:
            method: RPC method name
            params: Method parameters
            buffers: Optional binary buffers appended after automatically
                encoded numeric ndarray payloads.
            wait_for_response: If True, wait for and return the JSON-RPC response.
            timeout: Maximum time to wait for response (seconds)
            
        Returns:
            Self for method chaining (if wait_for_response=False),
            or response dict (if wait_for_response=True)

        Raises:
            MolvisRpcError: If the frontend returns a JSON-RPC error response.
        """
        response = self._transport.send_request(
            method,
            params,
            buffers=buffers,
            wait_for_response=wait_for_response,
            timeout=timeout,
        )
        if wait_for_response and response is not None:
            if isinstance(response, dict) and "error" in response:
                error = response["error"] or {}
                raise MolvisRpcError(
                    method=method,
                    code=int(error.get("code", -32603)),
                    message=str(error.get("message", "Unknown frontend error")),
                    data=error.get("data"),
                    request_id=response.get("id"),
                )
            return response
        return self
    
    def _handle_custom_msg(self, content: bytes | dict[str, Any], buffers: list[Any]) -> None:
        """Handle custom messages from frontend."""
        self._transport.handle_response(content, buffers)

    def _on_ready_changed(self, change: dict[str, Any]) -> None:
        """Handle ready state changes."""
        if change.get("new"):
            logger.debug(f"Scene '{self.name}' is ready")

    # -------------------------------------------------------------------------
    # Frontend Instance Management (for cleanup)
    # -------------------------------------------------------------------------

    @classmethod
    def get_frontend_instance_count(cls) -> int:
        """
        Ask the frontend runtime how many shared sessions are currently alive.
        """
        try:
            instances = list(cls._instances)
            if not instances:
                return 0
            first_instance = instances[0]
            response = first_instance.send_cmd(
                FrontendCommands.SESSION_COUNT.method,
                {},
                wait_for_response=True,
            )
            if isinstance(response, dict) and "result" in response:
                result = response["result"]
            else:
                result = response
            return result if isinstance(result, int) else 0
        except Exception as e:
            logger.error(f"Failed to get frontend instance count: {e}")
            return 0

    @classmethod
    def get_frontend_session_count(cls) -> int:
        """Alias for get_frontend_instance_count()."""
        return cls.get_frontend_instance_count()

    @classmethod
    def list_frontend_sessions(cls) -> list[str]:
        """List live frontend session keys."""
        try:
            instances = list(cls._instances)
            if not instances:
                return []
            first_instance = instances[0]
            response = first_instance.send_cmd(
                FrontendCommands.LIST_SESSIONS.method,
                {},
                wait_for_response=True,
            )
            if isinstance(response, dict) and "result" in response:
                result = response["result"]
            else:
                result = response
            return result if isinstance(result, list) else []
        except Exception as e:
            logger.error(f"Failed to list frontend sessions: {e}")
            return []

    @classmethod
    def clear_all_frontend_instances(cls) -> None:
        """Ask the frontend runtime to dispose every live shared session."""
        try:
            instances = list(cls._instances)
            if not instances:
                return
            first_instance = instances[0]
            first_instance.send_cmd(FrontendCommands.CLEAR_ALL_SESSIONS.method, {})
        except Exception as e:
            logger.error(f"Failed to clear all frontend instances: {e}")

    @classmethod
    def clear_all_frontend_sessions(cls) -> None:
        """Alias for clear_all_frontend_instances()."""
        cls.clear_all_frontend_instances()

    @classmethod
    def clear_all_frontend_content(cls) -> None:
        """Clear staged 3D content from every live frontend widget instance."""
        try:
            instances = list(cls._instances)
            if not instances:
                return
            first_instance = instances[0]
            first_instance.send_cmd(FrontendCommands.CLEAR_ALL_CONTENT.method, {})
        except Exception as e:
            logger.error(f"Failed to clear all frontend content: {e}")
