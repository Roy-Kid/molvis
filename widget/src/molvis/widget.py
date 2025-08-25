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
from typing import Any, Literal
from .types import JsonRPCRequest
import random
from dataclasses import asdict
import numpy as np
import weakref

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
    
    width: Any = traitlets.Int(800).tag(sync=True)
    height: Any = traitlets.Int(600).tag(sync=True)
    session_id: Any = traitlets.Int().tag(sync=True)
    ready: Any = traitlets.Bool(False).tag(sync=True)

    # Class variable to track all widget instances using weak references
    _instances: weakref.WeakSet["Molvis"] = weakref.WeakSet()

    def __init__(self, width: int = 800, height: int = 600, **kwargs: Any) -> None:
        # Generate unique session ID before calling parent constructor
        super().__init__(
            width=width,
            height=height,
            session_id=random.randint(0, 99999),
            **kwargs
        )
        
        # Add this instance to the class tracking set
        Molvis._instances.add(self)
        
        print(f"🔧 Molvis widget created with session_id: {self.session_id}")
        print(f"📊 Total widget instances: {len(Molvis._instances)}")
        
        # 设置 ESM
        module_dir = pathlib.Path(__file__).parent
        ESM_path = module_dir / "dist" / "index.js"
        assert ESM_path.exists(), f"{ESM_path} not found"
        self._esm = ESM_path.read_text()
        

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
            print(f"❌ Error getting frontend instance count: {e}")
            return 0

    @classmethod
    def clear_all_frontend_instances(cls) -> None:
        """Clear all frontend widget instances."""
        print("🧹 Requesting frontend to clear all widget instances...")
        try:
            # Just need one instance to send the command to frontend
            # Frontend will handle clearing all instances internally
            instances = list(cls._instances)
            if not instances:
                print("   ℹ️ No instances to send command through")
                return
            
            # Send command through first available instance
            first_instance = instances[0]
            first_instance.send_cmd("clear_all_instances", {})
            print(f"   ✅ Clear command sent through instance {first_instance.session_id}")
            print("✅ Frontend will clear all widget instances")
        except Exception as e:
            print(f"❌ Error sending clear command: {e}")

    @classmethod
    def clear_all_frontend_content(cls) -> None:
        """Clear all 3D content from all frontend widget instances."""
        print("🧹 Requesting frontend to clear all 3D content...")
        try:
            # Just need one instance to send the command to frontend
            # Frontend will handle clearing all content internally
            instances = list(cls._instances)
            if not instances:
                print("   ℹ️ No instances to send command through")
                return
            
            # Send command through first available instance
            first_instance = instances[0]
            first_instance.send_cmd("clear_all_content", {})
            print(f"   ✅ Clear content command sent through instance {first_instance.session_id}")
            print("✅ Frontend will clear all 3D content")
        except Exception as e:
            print(f"❌ Error sending clear content command: {e}")

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
        buffers: list[Any] | None = None
    ) -> "Molvis":
        """
        Send a command to the frontend.
        
        Args:
            method: RPC method name
            params: Method parameters
            buffers: Optional binary buffers
            
        Returns:
            Self for method chaining
        """
        if buffers is None:
            buffers = []
        jsonrpc = JsonRPCRequest(
            jsonrpc="2.0",
            method=method,
            params=params,
            id=self.session_id,
        )
        # Use custom encoder to handle numpy arrays
        self.send(json.dumps(asdict(jsonrpc), cls=NumpyEncoder), buffers=buffers)
        return self

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
        show_box: bool = False  # Changed to False since we use draw_box separately
    ) -> "Molvis":
        """
        Draw a molecular frame on the current frame (cumulative drawing).
        
        Args:
            frame: molpy Frame object
            style: Visualization style ("ball_and_stick", "spacefill", "wireframe")
            atom_radius: Global atom radius scaling or specific radii
            bond_radius: Global bond radius
            show_box: Whether to show simulation box (deprecated, use draw_box)
            
        Returns:
            Self for method chaining
        """
        try:
            frame_dict = frame.to_dict()
        except Exception as e:
            raise ValueError(f"Failed to convert frame to dict: {e}")
            
        if "blocks" not in frame_dict:
            raise ValueError("Frame must contain 'blocks' data")
            
        if "atoms" not in frame_dict["blocks"]:
            raise ValueError("Frame must contain 'atoms' block to draw")
            
        atoms_block = frame_dict["blocks"]["atoms"]
        if "xyz" not in atoms_block:
            raise ValueError("Atoms block must contain 'xyz' variable to draw")
            
        # Extract only the data we need for drawing
        draw_data = {
            "blocks": {
                "atoms": {
                    "xyz": atoms_block["xyz"],
                    "element": atoms_block.get("element", []),
                    "name": atoms_block.get("name", []),
                    "type": atoms_block.get("type", [])
                },
                "bonds": {}
            }
        }
        
        # Extract bonds if they exist
        if "bonds" in frame_dict["blocks"]:
            bonds_block = frame_dict["blocks"]["bonds"]
            if "i" in bonds_block and "j" in bonds_block:
                draw_data["blocks"]["bonds"] = {
                    "i": bonds_block["i"],
                    "j": bonds_block["j"],
                    "order": bonds_block.get("order", [])
                }
        
        # Note: Box is now handled separately via draw_box method
        
        params = {
            "frameData": draw_data,
            "options": {
                "atoms": {"radius": atom_radius},
                "bonds": {"radius": bond_radius},
                "box": {"visible": False},  # Always false, use draw_box for boxes
                "style": style
            }
        }
        self.send_cmd("draw_frame", params, [])
        return self

    def draw_box(
        self, 
        box: mp.Box,
        color: str | None = None,
        line_width: float = 1.0
    ) -> "Molvis":
        """
        Draw simulation box on current canvas (cumulative drawing).
        
        Args:
            box: molpy Box object
            color: Box color (hex string)
            line_width: Box line width
            
        Returns:
            Self for method chaining
        """
        try:
            box_dict = box.to_dict()
        except Exception as e:
            raise ValueError(f"Failed to convert box to dict: {e}")
            
        # Ensure pbc field exists (Box.to_dict() should always include it)
        if "pbc" not in box_dict:
            box_dict["pbc"] = [True, True, True]  # Default to periodic in all directions
            
        params = {
            "boxData": box_dict,
            "options": {
                "color": color,
                "lineWidth": line_width,
                "visible": True
            }
        }
        self.send_cmd("draw_box", params, [])
        return self

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

    # ==================== Legacy Methods (Deprecated) ====================
    
    def draw_molecule(
        self, 
        molecule: mp.Atomistic,
        style: Literal["ball_and_stick", "spacefill", "wireframe"] = "ball_and_stick",
        atom_radius: float | list[float] | None = None,
        bond_radius: float = 0.1,
        show_box: bool = False  # Updated to match draw_frame
    ) -> "Molvis":
        """
        [DEPRECATED] Use clear() + draw_frame() instead.
        Draw complete molecular structure - clear existing content and redraw.
        
        Note: To show simulation box, use draw_box() method separately.
        """
        import warnings
        warnings.warn(
            "draw_molecule is deprecated. Use clear() + draw_frame() instead.",
            DeprecationWarning,
            stacklevel=2
        )
        
        self.clear()
        frame = molecule.to_frame()
        return self.draw_frame(frame, style, atom_radius, bond_radius, show_box)

    def draw_atom(
        self, 
        name: str, 
        x: float, 
        y: float, 
        z: float, 
        element: str | None = None,
        radius: float | None = None
    ) -> "Molvis":
        """
        [DEPRECATED] Use draw_frame() with single atom frame instead.
        Draw single atom - clear existing content and redraw.
        """
        import warnings
        warnings.warn(
            "draw_atom is deprecated. Use draw_frame() with single atom frame instead.",
            DeprecationWarning,
            stacklevel=2
        )
        
        # Create a simple frame with one atom
        atom = mp.Atom(name=name, element=element or "C", xyz=[x, y, z])
        frame = mp.Frame()
        frame["atoms"] = mp.Block({
            "name": [name],
            "element": [element or "C"],
            "xyz": [[x, y, z]]
        })
        
        self.clear()
        return self.draw_frame(frame, atom_radius=radius)

    def draw_grid(
        self, 
        size: int = 20,
        min_spacing: float = 1.0,
        max_spacing: float = 10.0,
        color: str = "#4A4A4A",
        visible: bool = True,
        auto_update: bool = True
    ) -> "Molvis":
        """
        Draw dynamic grid that adjusts density based on camera distance.
        
        Args:
            size: Grid size (extends from -size/2 to +size/2)
            min_spacing: Minimum grid spacing (when camera is close)
            max_spacing: Maximum grid spacing (when camera is far)
            color: Grid color (hex string)
            visible: Whether grid is visible
            auto_update: Whether to automatically update grid density
            
        Returns:
            Self for method chaining
        """
        params = {
            "size": size,
            "minSpacing": min_spacing,
            "maxSpacing": max_spacing,
            "color": color,
            "visible": visible,
            "autoUpdate": auto_update
        }
        self.send_cmd("draw_grid", params, [])
        return self

    def show_grid(self) -> "Molvis":
        """
        Show the grid.
        
        Returns:
            Self for method chaining
        """
        return self.draw_grid(visible=True)

    def hide_grid(self) -> "Molvis":
        """
        Hide the grid.
        
        Returns:
            Self for method chaining
        """
        return self.draw_grid(visible=False)

    def toggle_grid(self) -> "Molvis":
        """
        Toggle grid visibility.
        
        Returns:
            Self for method chaining
        """
        # This would need to query current state, for now just show
        return self.show_grid()

    def get_current_frame(self) -> mp.Frame:
        """
        Get information about the current frame being displayed.
        
        Returns:
            mp.Frame: Current frame information including atoms, bonds, and metadata
        """
        try:
            # Get current frame info from the system
            params = {}
            result = self.send_cmd("get_current_frame", params, [])
            
            # Create a frame representation based on the result
            current_frame = mp.Frame()
            
            # Add metadata about the current frame
            current_frame.metadata = {
                "method": "get_current_frame",
                "note": "This is a representation of the current frame state",
                "timestamp": result.get("timestamp", 0) if isinstance(result, dict) else 0
            }
            
            return current_frame
            
        except Exception as e:
            # Fallback: return empty frame with error info
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
        """
        try:
            params = {}
            result = self.send_cmd("get_frame_info", params, [])
            
            # The result should contain detailed frame information
            if isinstance(result, dict):
                return result
            else:
                return {
                    "result": result,
                    "method": "get_frame_info",
                    "note": "Raw result from command execution"
                }
        except Exception as e:
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

    def _get_default_grid_value(self, key: str) -> Any:
        """Get default value for grid parameter."""
        defaults = {
            "mainColor": "#878787",
            "lineColor": "#969696", 
            "opacity": 0.98,
            "majorUnitFrequency": 10,
            "minorUnitVisibility": 0.7,
            "distanceThreshold": 50.0,
            "minGridStep": 1.0,
            "size": 10000.0
        }
        return defaults.get(key)

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
        """
        # Send command to frontend to check grid status
        # Note: This method currently doesn't return the actual status
        # since send_cmd doesn't handle return values
        self.send_cmd("is_grid_enabled", {}, [])
        
        # For now, return True as placeholder
        # In the future, this could be enhanced to handle frontend responses
        return True

    def update_grid_appearance(
        self,
        main_color: str | None = None,
        line_color: str | None = None,
        opacity: float | None = None,
        major_unit_frequency: int | None = None,
        minor_unit_visibility: float | None = None,
        distance_threshold: float | None = None,
        min_grid_step: float | None = None
    ) -> "Molvis":
        """
        [DEPRECATED] Use enable_grid() with parameters instead.
        Update grid appearance.
        
        This method is deprecated because enable_grid() now handles both
        enabling and updating the grid in-place.
        
        Args:
            main_color: Main grid color (hex string)
            line_color: Grid line color (hex string)
            opacity: Grid opacity (0.0 to 1.0)
            major_unit_frequency: Frequency of major grid lines
            minor_unit_visibility: Visibility of minor grid lines
            distance_threshold: Distance threshold for locking grid step
            min_grid_step: Minimum grid step when camera is close
            
        Returns:
            Self for method chaining
        """
        import warnings
        warnings.warn(
            "update_grid_appearance is deprecated. Use enable_grid() with parameters instead.",
            DeprecationWarning,
            stacklevel=2
        )
        
        # Convert to enable_grid call for backward compatibility
        grid_options = {
            "mainColor": main_color,
            "lineColor": line_color,
            "opacity": opacity,
            "majorUnitFrequency": major_unit_frequency,
            "minorUnitVisibility": minor_unit_visibility,
            "distanceThreshold": distance_threshold,
            "minGridStep": min_grid_step
        }
        
        # Only include non-None values
        params = {k: v for k, v in grid_options.items() if v is not None}
            
        self.send_cmd("update_grid_appearance", params, [])
        return self

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
        
        print(f"⏳ Waiting up to {timeout}s for frontend to initialize...")
        print(f"   Current ready state: {self.ready}")
        print(f"   Session ID: {self.session_id}")
        
        start_time = time.time()
        
        while not self.ready:
            # Check if we've exceeded timeout
            if time.time() - start_time > timeout:
                print(f"❌ Timeout after {timeout}s - frontend not ready")
                print(f"   Current ready state: {self.ready}")
                print(f"   This usually means:")
                print(f"   1. Frontend code hasn't executed yet")
                print(f"   2. Widget hasn't been displayed in Jupyter")
                print(f"   3. There's a communication issue")
                return False
            
            # Wait a bit before checking again
            time.sleep(0.1)
        
        print(f"✅ Frontend is ready! (took {time.time() - start_time:.2f}s)")
        return True
    
    def _on_ready_changed(self, change: Any) -> None:
        """
        Callback when the ready state changes.
        
        Args:
            change: Traitlets change object containing old and new values
        """
        print(f"🔄 Ready state changed: {change['old']} -> {change['new']}")
        if change['new']:
            print(f"🎉 Frontend is now ready for session {self.session_id}")
        else:
            print(f"⚠️ Frontend is no longer ready for session {self.session_id}")
    
    def is_ready(self) -> bool:
        """
        Check if the frontend is ready.
        
        Returns:
            True if frontend is ready, False otherwise
        """
        return bool(self.ready)
