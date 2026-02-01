#!/usr/bin/env python3
"""
Core Molvis scene class for Jupyter widget integration.
"""

from __future__ import annotations

import json
import logging
import pathlib
import threading
import uuid
import weakref
from collections import deque
from dataclasses import asdict
from typing import Any

import anywidget
import traitlets

from .commands import DrawingCommandsMixin, SelectionCommandsMixin, FrameCommandsMixin, SnapshotCommandsMixin
from .types import JsonRPCRequest
from .utils import NumpyEncoder

logger = logging.getLogger("molvis")

__all__ = ["Molvis"]

# Locate the bundled JavaScript module
module_dir = pathlib.Path(__file__).parent
ESM_path = module_dir / "dist" / "index.js"
if not ESM_path.exists():
    raise FileNotFoundError(f"ESM file not found: {ESM_path}")


class Molvis(anywidget.AnyWidget, DrawingCommandsMixin, SelectionCommandsMixin, FrameCommandsMixin, SnapshotCommandsMixin):
    """
    A widget for molecular visualization using molpy and anywidget.
    
    This widget provides an interactive 3D molecular visualization interface
    that can display molecular structures, atoms, bonds, and frames.
    
    Examples:
        >>> import molvis as mv
        >>> import molpy as mp
        >>> 
        >>> # Create a named scene
        >>> scene = mv.Molvis(name="protein_view", width=800, height=600)
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
    session_id: int = traitlets.Int().tag(sync=True)
    ready: bool = traitlets.Bool(False).tag(sync=True)

    # Class-level scene registry (by name)
    _scene_registry: dict[str, "Molvis"] = {}
    
    # Class variable to track all widget instances
    _instances: weakref.WeakSet["Molvis"] = weakref.WeakSet()

    _esm = ESM_path

    def __init__(
        self, 
        name: str | None = None, 
        width: int = 800, 
        height: int = 600, 
        **kwargs: Any
    ) -> None:
        """
        Create a new Molvis visualization scene.
        
        Args:
            name: Optional name for the scene. If not provided, a unique name is generated.
            width: Width of the widget in pixels.
            height: Height of the widget in pixels.
            **kwargs: Additional keyword arguments passed to anywidget.
        """
        # Generate unique session ID
        session_id = abs(hash(uuid.uuid4().hex)) % (2**31 - 1)
        
        # Generate name if not provided
        scene_name = name or f"scene_{session_id}"
        
        super().__init__(
            name=scene_name,
            width=width,
            height=height,
            session_id=session_id,
            **kwargs
        )
        
        # Register in scene registry
        Molvis._scene_registry[scene_name] = self
        Molvis._instances.add(self)
        
        # Response handling for bidirectional communication
        self._response_queue: dict[int, deque[dict[str, Any]]] = {}
        self._response_lock = threading.Lock()
        self._request_counter = 0
        
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
        Close this scene and remove it from the registry.
        
        This cleans up resources and removes the scene from the
        global registry so it can no longer be retrieved by name.
        """
        # Remove from registry
        if self.name in Molvis._scene_registry:
            del Molvis._scene_registry[self.name]
        
        # Clear content
        try:
            self.send_cmd("clear", {})
        except Exception as e:
            logger.warning(f"Error clearing scene on close: {e}")
        
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
            buffers: Optional binary buffers
            wait_for_response: If True, wait for and return the response
            timeout: Maximum time to wait for response (seconds)
            
        Returns:
            Self for method chaining (if wait_for_response=False),
            or response dict (if wait_for_response=True)
        """
        if buffers is None:
            buffers = []
        
        # Generate unique request ID
        with self._response_lock:
            self._request_counter += 1
            request_id = self._request_counter
        
        jsonrpc = JsonRPCRequest(
            jsonrpc="2.0",
            method=method,
            params=params,
            id=request_id,
        )
        
        # Use custom encoder to handle numpy arrays
        self.send(json.dumps(asdict(jsonrpc), cls=NumpyEncoder), buffers=buffers)
        
        if wait_for_response:
            return self._wait_for_response(request_id, timeout)
        return self
    
    def _wait_for_response(self, request_id: int, timeout: float) -> dict[str, Any]:
        """Wait for a response to a specific request."""
        import time
        
        start_time = time.time()
        queue: deque[dict[str, Any]] = deque()
        
        with self._response_lock:
            self._response_queue[request_id] = queue
        
        try:
            while time.time() - start_time < timeout:
                with self._response_lock:
                    if queue:
                        response = queue.popleft()
                        return response
                
                time.sleep(0.01)
            
            raise TimeoutError(f"Request {request_id} timed out after {timeout}s")
        finally:
            with self._response_lock:
                self._response_queue.pop(request_id, None)
    
    def _handle_custom_msg(self, content: bytes | dict[str, Any], buffers: list[Any]) -> None:
        """Handle custom messages from frontend."""
        try:
            if isinstance(content, bytes):
                response = json.loads(content.decode('utf-8'))
            elif isinstance(content, str):
                response = json.loads(content)
            elif isinstance(content, dict):
                response = content
            else:
                logger.warning(f"Unexpected response type: {type(content)}")
                return
            
            request_id = response.get("id")
            if request_id is None:
                logger.debug("Response missing id field")
                return
            
            with self._response_lock:
                if request_id in self._response_queue:
                    self._response_queue[request_id].append(response)
                else:
                    logger.debug(f"No waiting queue for request {request_id}")
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            logger.warning(f"Failed to parse response: {e}")
        except Exception as e:
            logger.warning(f"Error handling response: {e}")

    def _on_ready_changed(self, change: dict[str, Any]) -> None:
        """Handle ready state changes."""
        if change.get("new"):
            logger.debug(f"Scene '{self.name}' is ready")

    # -------------------------------------------------------------------------
    # Frontend Instance Management (for cleanup)
    # -------------------------------------------------------------------------

    @classmethod
    def get_frontend_instance_count(cls) -> int:
        """Get the current number of frontend widget instances."""
        try:
            instances = list(cls._instances)
            if not instances:
                return 0
            first_instance = instances[0]
            result = first_instance.send_cmd("get_instance_count", {})
            return result if isinstance(result, int) else 0
        except Exception as e:
            logger.error(f"Failed to get frontend instance count: {e}")
            return 0

    @classmethod
    def clear_all_frontend_instances(cls) -> None:
        """Clear all frontend widget instances."""
        try:
            instances = list(cls._instances)
            if not instances:
                return
            first_instance = instances[0]
            first_instance.send_cmd("clear_all_instances", {})
        except Exception as e:
            logger.error(f"Failed to clear all frontend instances: {e}")

    @classmethod
    def clear_all_frontend_content(cls) -> None:
        """Clear all 3D content from all frontend widget instances."""
        try:
            instances = list(cls._instances)
            if not instances:
                return
            first_instance = instances[0]
            first_instance.send_cmd("clear_all_content", {})
        except Exception as e:
            logger.error(f"Failed to clear all frontend content: {e}")
