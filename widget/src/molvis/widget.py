#!/usr/bin/env python3
"""
Molvis Jupyter Widget for molecular visualization.
"""

from __future__ import annotations

import pathlib
import anywidget
import traitlets
import logging
import json
import molpy as mp
from typing import Any, Literal, Optional
from .types import JsonRPCRequest
import uuid
from dataclasses import asdict
import numpy as np
import weakref
import threading
from collections import deque

logger = logging.getLogger("molvis")

__version__ = "0.1.0"


class NumpyEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle numpy arrays."""
    
    def default(self, o: Any) -> Any:
        if isinstance(o, np.ndarray):
            return o.tolist()
        if isinstance(o, np.integer):
            return int(o)
        if isinstance(o, np.floating):
            return float(o)
        return super().default(o)

        
module_dir = pathlib.Path(__file__).parent
ESM_path = module_dir / "dist" / "index.js"
if not ESM_path.exists():
    raise FileNotFoundError(f"ESM file not found: {ESM_path}")


class Molvis(anywidget.AnyWidget):
    """
    A widget for molecular visualization using molpy and anywidget.
    
    This widget provides an interactive 3D molecular visualization interface
    that can display molecular structures, atoms, bonds, and frames.
    
    Examples:
        >>> import molvis as mv
        >>> import molpy as mp
        >>> 
        >>> # Create a widget
        >>> widget = mv.Molvis(width=800, height=600)
        >>> 
        >>> # Draw a frame
        >>> frame = mp.Frame(...)
        >>> widget.draw_frame(frame)
        >>>
        >>> # Display the widget
        >>> widget
    """
    
    width: int = traitlets.Int(800).tag(sync=True)
    height: int = traitlets.Int(600).tag(sync=True)
    session_id: int = traitlets.Int().tag(sync=True)
    ready: bool = traitlets.Bool(False).tag(sync=True)

    # Class variable to track all widget instances using weak references
    _instances: weakref.WeakSet["Molvis"] = weakref.WeakSet()

    _esm = ESM_path

    def __init__(self, width: int = 800, height: int = 600, **kwargs: Any) -> None:
        # Generate unique session ID using UUID hash (convert to int for traitlets compatibility)
        # Use hash of UUID to get a deterministic int while maintaining uniqueness
        session_id = abs(hash(uuid.uuid4().hex)) % (2**31 - 1)
        
        super().__init__(
            width=width,
            height=height,
            session_id=session_id,
            **kwargs
        )
        Molvis._instances.add(self)
        
        # Add this instance to the class tracking set
        
        # Response handling for bidirectional communication
        self._response_queue: dict[int, deque[dict[str, Any]]] = {}
        self._response_lock = threading.Lock()
        self._request_counter = 0
        
        # Add observer for ready state changes
        self.observe(self._on_ready_changed, names=['ready'])

    @classmethod
    def get_frontend_instance_count(cls) -> int:
        """Get the current number of frontend widget instances."""
        try:
            # Get count from frontend via any existing instance
            instances = list(cls._instances)
            if not instances:
                return 0
            
            # Use the first instance to send command to frontend
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
            # Just need one instance to send the command to frontend
            # Frontend will handle clearing all instances internally
            instances = list(cls._instances)
            if not instances:
                return
            
            # Send command through first available instance
            first_instance = instances[0]
            first_instance.send_cmd("clear_all_instances", {})
        except Exception as e:
            logger.error(f"Failed to clear all frontend instances: {e}")

    @classmethod
    def clear_all_frontend_content(cls) -> None:
        """Clear all 3D content from all frontend widget instances."""
        try:
            # Just need one instance to send the command to frontend
            # Frontend will handle clearing all content internally
            instances = list(cls._instances)
            if not instances:
                return
            
            # Send command through first available instance
            first_instance = instances[0]
            first_instance.send_cmd("clear_all_content", {})
        except Exception as e:
            logger.error(f"Failed to clear all frontend content: {e}")

    @classmethod
    def get_instance_count(cls) -> int:
        """Get the current number of Python widget instances."""
        return len(cls._instances)

    @classmethod
    def list_instances(cls) -> list["Molvis"]:
        """Get a list of all current Python widget instances."""
        return list(cls._instances)

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
        queue = deque()
        
        with self._response_lock:
            self._response_queue[request_id] = queue
        
        try:
            while time.time() - start_time < timeout:
                with self._response_lock:
                    if queue:
                        response = queue.popleft()
                        return response
                
                time.sleep(0.01)  # Small sleep to avoid busy waiting
            
            raise TimeoutError(f"Request {request_id} timed out after {timeout}s")
        finally:
            with self._response_lock:
                self._response_queue.pop(request_id, None)
    
    def _handle_custom_msg(self, content: bytes | dict[str, Any], buffers: list[Any]) -> None:
        """
        Handle custom messages from frontend (responses to our requests).
        
        This method is called by anywidget when a custom message is received
        from the frontend via model.send("msg:custom", ...).
        """
        try:
            # Parse the response - anywidget may pass bytes or dict
            if isinstance(content, bytes):
                response = json.loads(content.decode('utf-8'))
            elif isinstance(content, str):
                response = json.loads(content)
            elif isinstance(content, dict):
                response = content
            else:
                logger.warning(f"Unexpected response type: {type(content)}")
                return
            
            # Extract request ID from response
            request_id = response.get("id")
            if request_id is None:
                logger.debug("Response missing id field")
                return
            
            # Check if we're waiting for this response
            with self._response_lock:
                if request_id in self._response_queue:
                    self._response_queue[request_id].append(response)
                else:
                    logger.debug(f"No waiting queue for request {request_id}")
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            logger.warning(f"Failed to parse response: {e}")
        except Exception as e:
            logger.warning(f"Error handling response: {e}")

    def new_frame(
        self, 
        name: str | None = None,
        clear: bool = True
    ) -> "Molvis":
        """
        Create a new frame and set it as current.
        
        Args:
            name: Optional name for the new frame
            clear: Whether to clear the world when creating new frame
            
        Returns:
            Self for method chaining
        """
        params = {
            "name": name,
            "clear": clear
        }
        self.send_cmd("new_frame", params, [])
        return self

    def draw_frame(
        self, 
        frame: mp.Frame,
        style: Literal["ball_and_stick", "spacefill", "wireframe"] = "ball_and_stick",
        atom_radius: float | list[float] | None = None,
        bond_radius: float = 0.1,
        include_metadata: bool = False
    ) -> "Molvis":
        """
        Draw a molecular frame on the current frame (cumulative drawing).
        
        This method uses the Frame's to_dict() method to extract all necessary data,
        preserving the structure defined by molpy's Frame class.
        
        Args:
            frame: molpy Frame object containing blocks (atoms, bonds, etc.)
            style: Visualization style ("ball_and_stick", "spacefill", "wireframe")
            atom_radius: Global atom radius scaling or list of specific radii per atom
            bond_radius: Global bond radius
            include_metadata: Whether to include frame metadata in the draw command
            
        Returns:
            Self for method chaining
            
        Raises:
            ValueError: If frame is invalid or missing required blocks
            TypeError: If frame is not a Frame instance
        """
        if not isinstance(frame, mp.Frame):
            raise TypeError(f"frame must be a molpy.Frame instance, got {type(frame)}")
        
        try:
            frame_dict = frame.to_dict()
        except AttributeError:
            raise ValueError("Frame object does not have to_dict() method")
        except Exception as e:
            raise ValueError(f"Failed to convert frame to dict: {e}") from e
            
        if not isinstance(frame_dict, dict):
            raise ValueError(f"Frame.to_dict() must return a dict, got {type(frame_dict)}")
            
        if "blocks" not in frame_dict:
            raise ValueError("Frame must contain 'blocks' data")
            
        if not isinstance(frame_dict["blocks"], dict):
            raise ValueError("Frame blocks must be a dictionary")
            
        # Validate atoms block
        if "atoms" not in frame_dict["blocks"]:
            raise ValueError("Frame must contain 'atoms' block to draw")
            
        atoms_block = frame_dict["blocks"]["atoms"]
        if not isinstance(atoms_block, dict):
            raise ValueError("Atoms block must be a dictionary")
            
        if "xyz" not in atoms_block:
            raise ValueError("Atoms block must contain 'xyz' variable to draw")
        
        # Use the full frame structure - let frontend handle what it needs
        # This preserves all data from the Frame, not just a subset
        draw_data: dict[str, Any] = {
            "blocks": {}
        }
        
        # Copy all blocks from frame (atoms, bonds, etc.)
        for block_name, block_data in frame_dict["blocks"].items():
            if isinstance(block_data, dict):
                draw_data["blocks"][block_name] = block_data
        
        # Include metadata if requested
        if include_metadata and "metadata" in frame_dict:
            draw_data["metadata"] = frame_dict["metadata"]
        
        params = {
            "frameData": draw_data,
            "options": {
                "atoms": {"radius": atom_radius},
                "bonds": {"radius": bond_radius},
                "style": style
            }
        }
        
        self.send_cmd("draw_frame", params, [])
        return self

    def draw_atomistic(
        self,
        atomistic: Any,  # mp.Atomistic, but avoid circular import
        style: Literal["ball_and_stick", "spacefill", "wireframe"] = "ball_and_stick",
        atom_radius: float | list[float] | None = None,
        bond_radius: float = 0.1,
        include_metadata: bool = False,
        atom_fields: list[str] | None = None
    ) -> "Molvis":
        """
        Draw an Atomistic object (Molecule, Residue, Crystal, etc.) on the current frame.
        
        This is a convenience method that converts the Atomistic object to a Frame
        using its to_frame() method and then calls draw_frame().
        
        Args:
            atomistic: molpy Atomistic object (Molecule, Residue, Crystal, etc.)
            style: Visualization style ("ball_and_stick", "spacefill", "wireframe")
            atom_radius: Global atom radius scaling or list of specific radii per atom
            bond_radius: Global bond radius
            include_metadata: Whether to include frame metadata in the draw command
            atom_fields: List of atom fields to extract (passed to to_frame())
            
        Returns:
            Self for method chaining
            
        Raises:
            TypeError: If atomistic is not an Atomistic instance
            ValueError: If atomistic cannot be converted to Frame
            
        Examples:
            >>> import molvis as mv
            >>> import molpy as mp
            >>> 
            >>> # Create a molecule
            >>> mol = mp.Molecule(name="water")
            >>> o = mol.def_atom(element="O", xyz=[0, 0, 0])
            >>> h1 = mol.def_atom(element="H", xyz=[0.96, 0, 0])
            >>> h2 = mol.def_atom(element="H", xyz=[-0.24, 0.92, 0])
            >>> mol.def_bond(o, h1)
            >>> mol.def_bond(o, h2)
            >>> 
            >>> # Draw it
            >>> widget = mv.Molvis(width=800, height=600)
            >>> widget.draw_atomistic(mol, style="ball_and_stick")
        """
        # Check if it has to_frame method (duck typing)
        if not hasattr(atomistic, 'to_frame'):
            raise TypeError(
                f"atomistic must have a to_frame() method, got {type(atomistic)}. "
                "Expected a molpy.Atomistic subclass (Molecule, Residue, Crystal, etc.)"
            )
        
        try:
            # Convert Atomistic to Frame
            if atom_fields is not None:
                frame = atomistic.to_frame(atom_fields=atom_fields)
            else:
                frame = atomistic.to_frame()
        except Exception as e:
            raise ValueError(f"Failed to convert Atomistic to Frame: {e}") from e
        
        # Use existing draw_frame method
        return self.draw_frame(
            frame=frame,
            style=style,
            atom_radius=atom_radius,
            bond_radius=bond_radius,
            include_metadata=include_metadata
        )

    def draw_box(
        self, 
        box: mp.Box,
        color: str | None = None,
        line_width: float = 1.0,
        visible: bool = True
    ) -> "Molvis":
        """
        Draw simulation box on current canvas (cumulative drawing).
        
        This method uses the Box's to_dict() method to extract all box properties
        (matrix, pbc, origin) as defined by molpy's Box class.
        
        Args:
            box: molpy Box object containing matrix, pbc, and origin
            color: Box color (hex string, e.g., "#FF0000")
            line_width: Box line width in pixels
            visible: Whether the box should be visible
            
        Returns:
            Self for method chaining
            
        Raises:
            ValueError: If box is invalid or missing required properties
            TypeError: If box is not a Box instance
        """
        if not isinstance(box, mp.Box):
            raise TypeError(f"box must be a molpy.Box instance, got {type(box)}")
        
        try:
            box_dict = box.to_dict()
        except AttributeError:
            raise ValueError("Box object does not have to_dict() method")
        except Exception as e:
            raise ValueError(f"Failed to convert box to dict: {e}") from e
            
        if not isinstance(box_dict, dict):
            raise ValueError(f"Box.to_dict() must return a dict, got {type(box_dict)}")
        
        # Validate required fields (Box.to_dict() should always include these)
        required_fields = ["matrix", "pbc", "origin"]
        missing_fields = [field for field in required_fields if field not in box_dict]
        if missing_fields:
            raise ValueError(f"Box dict missing required fields: {missing_fields}")
        
        # Validate matrix shape
        matrix = box_dict["matrix"]
        if not isinstance(matrix, list) or len(matrix) != 3:
            raise ValueError("Box matrix must be a 3x3 matrix (list of 3 lists)")
        for row in matrix:
            if not isinstance(row, list) or len(row) != 3:
                raise ValueError("Box matrix must be a 3x3 matrix")
        
        # Validate pbc
        pbc = box_dict["pbc"]
        if not isinstance(pbc, list) or len(pbc) != 3:
            raise ValueError("Box pbc must be a list of 3 booleans")
        
        # Validate origin
        origin = box_dict["origin"]
        if not isinstance(origin, list) or len(origin) != 3:
            raise ValueError("Box origin must be a list of 3 floats")
            
        params = {
            "boxData": box_dict,
            "options": {
                "color": color,
                "lineWidth": line_width,
                "visible": visible
            }
        }
        
        self.send_cmd("draw_box", params, [])
        return self

    def draw_atoms(
        self,
        atoms: Any | list[Any],  # mp.Atom or list[mp.Atom]
        style: Literal["ball_and_stick", "spacefill", "wireframe"] = "ball_and_stick",
        atom_radius: float | list[float] | None = None,
        color: str | list[str] | None = None
    ) -> "Molvis":
        """
        Draw individual atoms or a list of atoms on the current frame.
        
        This method extracts atom properties (xyz, element, type, etc.) and creates
        a temporary Frame to render them. Useful for highlighting specific atoms
        or drawing partial structures.
        
        Args:
            atoms: Single Atom object or list of Atom objects
            style: Visualization style ("ball_and_stick", "spacefill", "wireframe")
            atom_radius: Global atom radius scaling or list of specific radii per atom
            color: Optional color override (hex string or list of hex strings)
            
        Returns:
            Self for method chaining
            
        Raises:
            TypeError: If atoms is not an Atom or list of Atoms
            ValueError: If atoms are missing required properties (xyz)
            
        Examples:
            >>> import molvis as mv
            >>> import molpy as mp
            >>> 
            >>> mol = mp.Molecule(name="test")
            >>> a1 = mol.def_atom(element="C", xyz=[0, 0, 0])
            >>> a2 = mol.def_atom(element="H", xyz=[1, 0, 0])
            >>> 
            >>> widget = mv.Molvis()
            >>> # Draw single atom
            >>> widget.draw_atoms(a1, style="spacefill")
            >>> # Draw multiple atoms
            >>> widget.draw_atoms([a1, a2], atom_radius=0.5)
        """
        import numpy as np
        
        # Normalize to list
        if not isinstance(atoms, list):
            atoms = [atoms]
        
        if not atoms:
            raise ValueError("atoms list cannot be empty")
        
        # Extract atom properties
        xyz_list = []
        element_list = []
        type_list = []
        
        for atom in atoms:
            # Check if it's an atom-like object (has 'get' method or dict-like)
            if hasattr(atom, 'get'):
                xyz = atom.get('xyz')
                element = atom.get('element', atom.get('symbol', 'C'))
                atom_type = atom.get('type', 1)
            elif isinstance(atom, dict):
                xyz = atom.get('xyz')
                element = atom.get('element', atom.get('symbol', 'C'))
                atom_type = atom.get('type', 1)
            else:
                raise TypeError(
                    f"Each atom must have a 'get' method or be dict-like, got {type(atom)}"
                )
            
            if xyz is None:
                raise ValueError("Each atom must have 'xyz' coordinates")
            
            xyz_list.append(xyz)
            element_list.append(element)
            type_list.append(atom_type)
        
        # Convert to numpy arrays
        xyz_array = np.array(xyz_list)
        
        # Create a temporary Frame
        atoms_block = {
            'xyz': xyz_array,
            'element': np.array(element_list),
            'type': np.array(type_list)
        }
        
        # Add color if provided
        if color is not None:
            if isinstance(color, str):
                color = [color] * len(atoms)
            atoms_block['color'] = np.array(color)
        
        frame = mp.Frame(blocks={'atoms': atoms_block})
        
        # Use existing draw_frame method
        return self.draw_frame(
            frame=frame,
            style=style,
            atom_radius=atom_radius,
            bond_radius=0.0  # No bonds for individual atoms
        )

    def clear(self) -> "Molvis":
        """
        Clear all content from canvas and start fresh.
        
        Returns:
            Self for method chaining
        """
        self.send_cmd("clear", {}, [])
        return self

    def set_style(
        self, 
        style: Literal["ball_and_stick", "spacefill", "wireframe"] = "ball_and_stick",
        atom_radius: float | list[float] | None = None,
        bond_radius: float = 0.1
    ) -> "Molvis":
        """
        Set global visualization style parameters.
        
        Args:
            style: Visualization style ("ball_and_stick", "spacefill", "wireframe")
            atom_radius: Global atom radius scaling or specific radii
            bond_radius: Global bond radius
            
        Returns:
            Self for method chaining
        """
        params = {
            "style": style,
            "atoms": {"radius": atom_radius},
            "bonds": {"radius": bond_radius}
        }
        self.send_cmd("set_style", params, [])
        return self

    def set_theme(self, theme: str) -> "Molvis":
        """
        Set color theme for molecular visualization.
        
        Args:
            theme: Theme name ("jmol", "rasmol", "modern", "vivid", "pastel")
            
        Returns:
            Self for method chaining
        """
        self.send_cmd("set_theme", {"theme": theme}, [])
        return self

    def set_view_mode(self, mode: str) -> "Molvis":
        """
        Set camera view mode.
        
        Args:
            mode: View mode ("persp", "ortho", "top", "front", "side")
            
        Returns:
            Self for method chaining
        """
        self.send_cmd("set_view_mode", {"mode": mode}, [])
        return self

    def get_current_frame(self) -> mp.Frame:
        """
        Get information about the current frame being displayed.
        
        Returns:
            mp.Frame: Current frame information including atoms, bonds, and metadata
            
        Raises:
            TimeoutError: If the request times out
            ValueError: If the response is invalid
        """
        try:
            params = {}
            result = self.send_cmd("get_current_frame", params, [], wait_for_response=True, timeout=5.0)
            
            if not isinstance(result, dict):
                raise ValueError(f"Invalid response type: {type(result)}")
            
            # Check for error in response
            if "error" in result:
                error_info = result["error"]
                raise ValueError(f"Frontend error: {error_info.get('message', 'Unknown error')}")
            
            # Extract result data
            frame_data = result.get("result", {})
            if not isinstance(frame_data, dict):
                raise ValueError(f"Invalid result format: {type(frame_data)}")
            
            # Reconstruct Frame from response
            try:
                current_frame = mp.Frame.from_dict(frame_data)
            except Exception as e:
                # Fallback: create empty frame with metadata
                current_frame = mp.Frame()
                current_frame.metadata = {
                    "error": f"Failed to reconstruct frame: {str(e)}",
                    "raw_data": frame_data
                }
            
            return current_frame
            
        except TimeoutError:
            logger.error("Timeout waiting for get_current_frame response")
            raise
        except Exception as e:
            logger.error(f"Error getting current frame: {e}")
            # Return empty frame with error info
            error_frame = mp.Frame()
            error_frame.metadata = {
                "error": f"Failed to get current frame: {str(e)}",
                "method": "get_current_frame"
            }
            return error_frame

    def get_frame_info(self) -> dict[str, Any]:
        """
        Get detailed information about the current frame state.
        
        Returns:
            dict: Information about current frame including atom count, bond count, etc.
            
        Raises:
            TimeoutError: If the request times out
        """
        try:
            params = {}
            result = self.send_cmd("get_frame_info", params, [], wait_for_response=True, timeout=5.0)
            
            if not isinstance(result, dict):
                return {
                    "error": f"Invalid response type: {type(result)}",
                    "method": "get_frame_info"
                }
            
            # Check for error in response
            if "error" in result:
                return {
                    "error": result["error"].get("message", "Unknown error"),
                    "method": "get_frame_info"
                }
            
            # Return the result data
            frame_info = result.get("result", {})
            if isinstance(frame_info, dict):
                return frame_info
            else:
                return {
                    "result": frame_info,
                    "method": "get_frame_info",
                    "note": "Raw result from command execution"
                }
        except TimeoutError:
            logger.error("Timeout waiting for get_frame_info response")
            return {
                "error": "Request timed out",
                "method": "get_frame_info"
            }
        except Exception as e:
            logger.error(f"Error getting frame info: {e}")
            return {
                "error": f"Failed to get frame info: {str(e)}",
                "method": "get_frame_info"
            }

    def get_frame_summary(self) -> dict[str, Any]:
        """
        Get a summary of the current frame state.
        
        Returns:
            dict: Summary information about current frame
        """
        try:
            # Get basic frame info
            frame_info = self.get_frame_info()
            
            if "error" in frame_info:
                return frame_info
            
            # Extract summary information
            current = frame_info.get("current", {})
            system = frame_info.get("system", {})
            world = frame_info.get("world", {})
            
            summary = {
                "frame_index": current.get("index", 0),
                "total_frames": system.get("totalFrames", 1),
                "atom_count": len(current.get("atoms", [])),
                "bond_count": len(current.get("bonds", [])),
                "is_running": world.get("isRunning", False),
                "mesh_count": world.get("meshCount", 0),
                "timestamp": frame_info.get("timestamp", 0)
            }
            
            return summary
            
        except Exception as e:
            return {
                "error": f"Failed to get frame summary: {str(e)}",
                "method": "get_frame_summary"
            }

    def enable_grid(
        self,
        main_color: str = "#878787",  # Default from GridMaterial (0.53, 0.53, 0.53)
        line_color: str = "#969696",  # Default from GridMaterial (0.59, 0.59, 0.59)
        opacity: float = 0.98,       # Default from GridMaterial
        major_unit_frequency: int = 10,  # Default from GridMaterial
        minor_unit_visibility: float = 0.7,  # Default from GridMaterial
        distance_threshold: float = 50.0,  # Default from GridGround
        min_grid_step: float = 1.0,  # Default from GridGround
        size: float = 10000.0        # Default from GridGround
    ) -> "Molvis":
        """
        Enable or disable the adaptive grid ground with custom settings.
        
        Args:
            main_color: Main grid color (hex string, default: "#878787")
            line_color: Grid line color (hex string, default: "#969696")
            opacity: Grid opacity (0.0 to 1.0, default: 0.98)
            major_unit_frequency: Frequency of major grid lines (default: 10)
            minor_unit_visibility: Visibility of minor grid lines (0.0 to 1.0, default: 0.7)
            distance_threshold: Distance threshold for locking grid step (default: 50.0)
            min_grid_step: Minimum grid step when camera is close (default: 1.0)
            size: Grid size in world units (default: 10000.0)
            
        Returns:
            Self for method chaining
        """
        # Always send enable_grid command, let frontend handle the logic
        
        grid_options = {
            "mainColor": main_color,
            "lineColor": line_color,
            "opacity": opacity,
            "majorUnitFrequency": major_unit_frequency,
            "minorUnitVisibility": minor_unit_visibility,
            "distanceThreshold": distance_threshold,
            "minGridStep": min_grid_step,
            "size": size
        }
        
        self.send_cmd("enable_grid", grid_options, [])
        return self



    def disable_grid(self) -> "Molvis":
        """
        Disable the adaptive grid ground.
        
        Returns:
            Self for method chaining
        """
        self.send_cmd("disable_grid", {}, [])
        return self

    def is_grid_enabled(self) -> bool:
        """
        Check if grid is currently enabled.
        
        Returns:
            True if grid is enabled, False otherwise
            
        Raises:
            TimeoutError: If the request times out
            ValueError: If the response is invalid
        """
        try:
            result = self.send_cmd("is_grid_enabled", {}, [], wait_for_response=True, timeout=2.0)
            
            if not isinstance(result, dict):
                logger.warning(f"Invalid response type for is_grid_enabled: {type(result)}")
                return False
            
            # Check for error
            if "error" in result:
                logger.warning(f"Error checking grid status: {result['error']}")
                return False
            
            # Extract result
            enabled = result.get("result", False)
            return bool(enabled)
            
        except TimeoutError:
            logger.warning("Timeout checking grid status")
            return False
        except Exception as e:
            logger.warning(f"Error checking grid status: {e}")
            return False



    def set_grid_size(self, size: float) -> "Molvis":
        """
        Set grid size.
        
        Args:
            size: Grid size in world units
            
        Returns:
            Self for method chaining
        """
        params = {"size": size}
        self.send_cmd("set_grid_size", params, [])
        return self

    def wait_for_ready(self, timeout: float = 5.0) -> bool:
        """
        Wait for the frontend widget to be ready.
        
        Args:
            timeout: Maximum time to wait in seconds
            
        Returns:
            True if ready, False if timeout
        """
        import time
        
        start_time = time.time()
        
        while not self.ready:
            # Check if we've exceeded timeout
            if time.time() - start_time > timeout:
                return False
            
            # Wait a bit before checking again
            time.sleep(0.1)
        
        return True
    
    def _on_ready_changed(self, change: Any) -> None:
        """
        Callback when the ready state changes.
        
        Args:
            change: Traitlets change object containing old and new values
        """
        if change.get("new", False):
            logger.info(f"Widget {self.session_id} is ready")
        else:
            logger.debug(f"Widget {self.session_id} ready state changed to False")
    
    def is_ready(self) -> bool:
        """
        Check if the frontend is ready.
        
        Returns:
            True if frontend is ready, False otherwise
        """
        return bool(self.ready)
    
    def highlight_atoms(
        self,
        atom_indices: list[int] | int,
        color: str = "#FF0000",
        scale: float = 1.2,
        opacity: float = 1.0
    ) -> "Molvis":
        """
        Highlight specific atoms by index with custom color and scaling.
        
        This method sends a command to the frontend to visually emphasize
        selected atoms, useful for showing search results, selections, or
        important structural features.
        
        Args:
            atom_indices: Single atom index or list of atom indices to highlight
            color: Highlight color (hex string, default: "#FF0000" red)
            scale: Scale factor for highlighted atoms (default: 1.2)
            opacity: Opacity of highlight (0.0 to 1.0, default: 1.0)
            
        Returns:
            Self for method chaining
            
        Examples:
            >>> widget = mv.Molvis()
            >>> widget.draw_frame(frame)
            >>> # Highlight first three atoms in red
            >>> widget.highlight_atoms([0, 1, 2], color='#FF0000')
            >>> # Highlight single atom in blue
            >>> widget.highlight_atoms(5, color='#0000FF', scale=1.5)
        """
        # Normalize to list
        if isinstance(atom_indices, int):
            atom_indices = [atom_indices]
        
        params = {
            "indices": atom_indices,
            "color": color,
            "scale": scale,
            "opacity": opacity
        }
        
        self.send_cmd("highlight_atoms", params, [])
        return self
    
    def clear_highlights(self) -> "Molvis":
        """
        Clear all atom highlights.
        
        Returns:
            Self for method chaining
            
        Examples:
            >>> widget.clear_highlights()
        """
        self.send_cmd("clear_highlights", {}, [])
        return self
    
    def draw_trajectory(
        self,
        trajectory: Any,  # mp.Trajectory or iterable of Frames
        fps: int = 30,
        loop: bool = True,
        style: Literal["ball_and_stick", "spacefill", "wireframe"] = "ball_and_stick",
        atom_radius: float | None = None,
        bond_radius: float = 0.1
    ) -> "Molvis":
        """
        Load a trajectory for animation playback.
        
        This method sends all frames from a trajectory to the frontend for
        animation playback. The trajectory can be a molpy Trajectory object
        or any iterable of Frame objects.
        
        Args:
            trajectory: molpy Trajectory object or iterable of Frames
            fps: Frames per second for playback (default: 30)
            loop: Whether to loop the animation (default: True)
            style: Visualization style for all frames
            atom_radius: Global atom radius scaling
            bond_radius: Global bond radius
            
        Returns:
            Self for method chaining
            
        Raises:
            ValueError: If trajectory is empty or invalid
            
        Examples:
            >>> import molpy as mp
            >>> import molvis as mv
            >>> 
            >>> # Load trajectory from file
            >>> traj = mp.Trajectory.from_file("traj.lammpstrj")
            >>> 
            >>> # Draw and play
            >>> widget = mv.Molvis()
            >>> widget.draw_trajectory(traj, fps=30, loop=True)
            >>> widget.play_animation()
        """
        # Convert trajectory to list of frame dicts
        frames_data = []
        
        try:
            # Try to iterate over trajectory
            for frame in trajectory:
                if not isinstance(frame, mp.Frame):
                    raise TypeError(f"Expected Frame object, got {type(frame)}")
                
                frame_dict = frame.to_dict()
                frames_data.append(frame_dict)
        except TypeError as e:
            raise ValueError(f"trajectory must be iterable, got {type(trajectory)}") from e
        
        if not frames_data:
            raise ValueError("trajectory is empty")
        
        params = {
            "frames": frames_data,
            "fps": fps,
            "loop": loop,
            "options": {
                "style": style,
                "atoms": {"radius": atom_radius},
                "bonds": {"radius": bond_radius}
            }
        }
        
        self.send_cmd("draw_trajectory", params, [])
        return self
    
    def play_animation(self, fps: int | None = None) -> "Molvis":
        """
        Start playing the loaded trajectory animation.
        
        Args:
            fps: Optional frames per second override
            
        Returns:
            Self for method chaining
            
        Examples:
            >>> widget.play_animation(fps=60)
        """
        params = {}
        if fps is not None:
            params["fps"] = fps
        
        self.send_cmd("play_animation", params, [])
        return self
    
    def pause_animation(self) -> "Molvis":
        """
        Pause the trajectory animation.
        
        Returns:
            Self for method chaining
            
        Examples:
            >>> widget.pause_animation()
        """
        self.send_cmd("pause_animation", {}, [])
        return self
    
    def set_animation_frame(self, frame_index: int) -> "Molvis":
        """
        Jump to a specific frame in the trajectory.
        
        Args:
            frame_index: Index of frame to display (0-based)
            
        Returns:
            Self for method chaining
            
        Examples:
            >>> widget.set_animation_frame(50)  # Jump to frame 50
        """
        params = {"frameIndex": frame_index}
        self.send_cmd("set_animation_frame", params, [])
        return self
