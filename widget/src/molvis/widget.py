import pathlib
import anywidget
import traitlets
import logging
import json
import molpy as mp
from typing import Optional, List, Dict, Any, Union
from .types import JsonRPCRequest
import random
from dataclasses import asdict
import numpy as np

logger = logging.getLogger("molvis")

__version__ = "0.1.0"

# Get the directory where this module is located
module_dir = pathlib.Path(__file__).parent
ESM_path = module_dir / "static" / "index.js"
assert ESM_path.exists(), f"{ESM_path} not found"
ESM = ESM_path.read_text()


class NumpyEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle numpy arrays."""
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        return super().default(obj)


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

    _esm = ESM
    width = traitlets.Int(800).tag(sync=True)
    height = traitlets.Int(600).tag(sync=True)
    session_id = traitlets.Int(random.randint(0, 99999)).tag(sync=True)

    def __init__(
        self, 
        width: int = 800, 
        height: int = 600, 
        reload: bool = False, 
        **kwargs
    ):
        """
        Initialize the Molvis widget.
        
        Args:
            width: Widget width in pixels
            height: Widget height in pixels
            reload: Whether to reload the frontend JavaScript
            **kwargs: Additional arguments passed to AnyWidget
        """
        super().__init__(**kwargs)
        self.width = width
        self.height = height

        if reload:
            # Force reload of the frontend
            self._esm = ESM_path.read_text()
            logger.info("Reloaded ESM from disk")

    def send_cmd(
        self, 
        method: str, 
        params: Dict[str, Any], 
        buffers: Optional[List] = None
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

    def draw_atom(
        self, 
        name: str, 
        x: float, 
        y: float, 
        z: float, 
        element: Optional[str] = None
    ) -> "Molvis":
        """
        Draw a single atom.
        
        Args:
            name: Atom name
            x: X coordinate
            y: Y coordinate
            z: Z coordinate
            element: Element symbol (optional)
            
        Returns:
            Self for method chaining
        """
        atom_data = {
            "name": name,
            "x": x,
            "y": y,
            "z": z,
            "element": element,
        }
        self.send_cmd("draw_atom", atom_data, [])
        return self

    def draw_bond(
        self, 
        i: int, 
        j: int, 
        order: int = 1, 
        **kwargs
    ) -> "Molvis":
        """
        Draw a single bond between atoms i and j.
        
        Args:
            i: Index of first atom
            j: Index of second atom
            order: Bond order (default: 1)
            **kwargs: Additional bond properties
            
        Returns:
            Self for method chaining
        """
        bond_data = {
            "i": i,
            "j": j,
            "order": order,
            **kwargs,
        }
        self.send_cmd("draw_bond", bond_data, [])
        return self

    def draw_frame(
        self, 
        frame: mp.Frame,
        style: str = "ball_and_stick",
        atom_radius: Optional[Union[float, List[float]]] = None,
        bond_radius: float = 0.1,
        show_box: bool = True,
        clean: bool = True
    ) -> "Molvis":
        """
        Draw a molecular frame.
        
        Args:
            frame: molpy Frame object to visualize
            style: Visualization style ("ball_and_stick", "spacefill", etc.)
            atom_radius: Atom radius specification:
                - None: Use element-specific radii from palette (default)
                - float: Global scaling factor for all atoms
                - List[float]: Specific radius for each atom
            bond_radius: Radius of bonds
            show_box: Whether to show the simulation box
            clean: Whether to clear previous visualization
            
        Returns:
            Self for method chaining
            
        Raises:
            ValueError: If frame doesn't contain required data
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
            
        params = {
            "frameData": frame_dict,
            "options": {
                "atoms": {"radius": atom_radius},
                "bonds": {"radius": bond_radius},
                "box": {"visible": show_box},
                "style": style,
                "clean": clean
            }
        }
        self.send_cmd("draw_frame", params, [])
        return self

    def clear(self) -> "Molvis":
        """
        Clear the visualization.
        
        Returns:
            Self for method chaining
        """
        self.send_cmd("clear", {}, [])
        return self

    def set_camera(
        self, 
        position: Optional[List[float]] = None, 
        target: Optional[List[float]] = None
    ) -> "Molvis":
        """
        Set camera position and target.
        
        Args:
            position: Camera position [x, y, z]
            target: Camera target point [x, y, z]
            
        Returns:
            Self for method chaining
        """
        params = {}
        if position is not None:
            if len(position) != 3:
                raise ValueError("Camera position must be a list of 3 coordinates")
            params["position"] = position
        if target is not None:
            if len(target) != 3:
                raise ValueError("Camera target must be a list of 3 coordinates")
            params["target"] = target
        self.send_cmd("set_camera", params, [])
        return self

    def set_style(self, style: str = "ball_and_stick") -> "Molvis":
        """
        Set visualization style.
        
        Args:
            style: Visualization style ("ball_and_stick", "spacefill", "wireframe", etc.)
            
        Returns:
            Self for method chaining
        """
        params = {"style": style}
        self.send_cmd("set_style", params, [])
        return self

    def set_atom_radius(self, radius: Optional[Union[float, List[float]]]) -> "Molvis":
        """
        Set the radius for all atoms.
        
        Args:
            radius: Atom radius specification:
                - None: Use element-specific radii from palette
                - float: Global scaling factor for all atoms
                - List[float]: Specific radius for each atom
                
        Returns:
            Self for method chaining
        """
        params = {"radius": radius}
        self.send_cmd("set_atom_radius", params, [])
        return self

    def set_bond_radius(self, radius: float) -> "Molvis":
        """
        Set the radius for all bonds.
        
        Args:
            radius: Bond radius
            
        Returns:
            Self for method chaining
        """
        params = {"radius": radius}
        self.send_cmd("set_bond_radius", params, [])
        return self

    def show_box(self, visible: bool = True) -> "Molvis":
        """
        Show or hide the simulation box.
        
        Args:
            visible: Whether to show the box
            
        Returns:
            Self for method chaining
        """
        params = {"visible": visible}
        self.send_cmd("show_box", params, [])
        return self
