#!/usr/bin/env python3
"""
Drawing and visualization commands for MolVis widget.

These methods are mixed into the Molvis class to provide drawing capabilities.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Literal

import molpy as mp
import numpy as np

from .catalog import FrontendCommands

if TYPE_CHECKING:
    from ..scene import Molvis

logger = logging.getLogger("molvis")

__all__ = ["DrawingCommandsMixin"]


class DrawingCommandsMixin:
    """Mixin class providing drawing commands for Molvis widget."""

    def _normalize_atoms_block(self, atoms_block: dict[str, Any]) -> dict[str, Any]:
        """Ensure atom coordinates are exposed as x, y, z arrays, converting from xyz if needed."""
        if not isinstance(atoms_block, dict):
            raise ValueError("Atoms block must be a dictionary")

        if all(coord in atoms_block for coord in ("x", "y", "z")):
            return atoms_block

        if "xyz" not in atoms_block:
            raise ValueError("Atoms block must contain 'x', 'y', 'z' coordinates to draw")

        xyz_array = np.asarray(atoms_block["xyz"])
        if xyz_array.ndim != 2 or xyz_array.shape[1] != 3:
            raise ValueError("Atoms 'xyz' must be an Nx3 array")

        normalized = dict(atoms_block)
        normalized["x"] = xyz_array[:, 0]
        normalized["y"] = xyz_array[:, 1]
        normalized["z"] = xyz_array[:, 2]
        normalized.pop("xyz", None)
        return normalized

    def new_frame(
        self: "Molvis",
        name: str | None = None,
        clear: bool = True
    ) -> "Molvis":
        """
        Create a new empty frame in the current shared frontend session.
        
        Args:
            name: Optional name for the new frame
            clear: Whether to clear the world when creating new frame
            
        Returns:
            Self for method chaining

        Raises:
            molvis.MolvisRpcError: If the frontend rejects the command.
        """
        params = {
            "name": name,
            "clear": clear
        }
        self.send_cmd(
            FrontendCommands.NEW_FRAME.method,
            params,
            wait_for_response=True,
        )
        return self

    def draw_frame(
        self: "Molvis",
        frame: mp.Frame,
        style: Literal["ball_and_stick", "spacefill", "wireframe"] = "ball_and_stick",
        atom_radius: float | list[float] | None = None,
        bond_radius: float | None = None,
        include_metadata: bool = False
    ) -> "Molvis":
        """
        Draw a molecular frame on the current frame (cumulative drawing).
        
        Args:
            frame: molpy Frame object containing blocks (atoms, bonds, etc.)
            style: Visualization style ("ball_and_stick", "spacefill", "wireframe")
            atom_radius: Global atom radius scaling or list of specific radii per atom
            bond_radius: Global bond radius
            include_metadata: Whether to include frame metadata in the draw command
            
        Returns:
            Self for method chaining

        Raises:
            molvis.MolvisRpcError: If frontend validation or rendering fails.
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
            
        if "atoms" not in frame_dict["blocks"]:
            raise ValueError("Frame must contain 'atoms' block to draw")
            
        atoms_block = frame_dict["blocks"]["atoms"]
        atoms_block = self._normalize_atoms_block(atoms_block)
            
        draw_data: dict[str, Any] = {"blocks": {}}
        
        for block_name, block_data in frame_dict["blocks"].items():
            if not isinstance(block_data, dict):
                continue
            if block_name == "atoms":
                draw_data["blocks"][block_name] = atoms_block
            else:
                draw_data["blocks"][block_name] = block_data
        
        if include_metadata and "metadata" in frame_dict:
            draw_data["metadata"] = frame_dict["metadata"]
        
        params = {
            "frame": draw_data,
            "options": {
                "atoms": {"radius": atom_radius},
                "bonds": {"radius": bond_radius},
                "style": style
            }
        }
        
        self.send_cmd(
            FrontendCommands.DRAW_FRAME.method,
            params,
            wait_for_response=True,
        )
        return self

    def draw_atomistic(
        self: "Molvis",
        atomistic: Any,
        style: Literal["ball_and_stick", "spacefill", "wireframe"] = "ball_and_stick",
        atom_radius: float | list[float] | None = None,
        bond_radius: float | None = None,
        include_metadata: bool = False,
        atom_fields: list[str] | None = None
    ) -> "Molvis":
        """
        Draw an Atomistic object (Molecule, Residue, Crystal, etc.).
        
        Args:
            atomistic: molpy Atomistic object
            style: Visualization style
            atom_radius: Global atom radius scaling
            bond_radius: Global bond radius
            include_metadata: Whether to include frame metadata
            atom_fields: List of atom fields to extract
            
        Returns:
            Self for method chaining

        Raises:
            molvis.MolvisRpcError: If the frontend rejects the command.
        """
        if not hasattr(atomistic, 'to_frame'):
            raise TypeError(
                f"atomistic must have a to_frame() method, got {type(atomistic)}. "
                "Expected a molpy.Atomistic subclass (Molecule, Residue, Crystal, etc.)"
            )
        
        try:
            if atom_fields is not None:
                frame = atomistic.to_frame(atom_fields=atom_fields)
            else:
                frame = atomistic.to_frame()
        except Exception as e:
            raise ValueError(f"Failed to convert Atomistic to Frame: {e}") from e
        
        return self.draw_frame(
            frame=frame,
            style=style,
            atom_radius=atom_radius,
            bond_radius=bond_radius,
            include_metadata=include_metadata
        )

    def draw_box(
        self: "Molvis",
        box: mp.Box,
        color: str | None = None,
        line_width: float = 1.0,
        visible: bool = True
    ) -> "Molvis":
        """
        Draw simulation box on current canvas.
        
        Args:
            box: molpy Box object
            color: Box color (hex string)
            line_width: Box line width in pixels
            visible: Whether the box should be visible
            
        Returns:
            Self for method chaining
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
        
        required_fields = ["matrix", "pbc", "origin"]
        missing_fields = [f for f in required_fields if f not in box_dict]
        if missing_fields:
            raise ValueError(f"Box dict missing required fields: {missing_fields}")
            
        params = {
            "box": box_dict,
            "options": {
                "color": color,
                "lineWidth": line_width,
                "visible": visible
            }
        }
        
        self.send_cmd(
            FrontendCommands.DRAW_BOX.method,
            params,
            wait_for_response=True,
        )
        return self

    def draw_atoms(
        self: "Molvis",
        atoms: Any | list[Any],
        style: Literal["ball_and_stick", "spacefill", "wireframe"] = "ball_and_stick",
        atom_radius: float | list[float] | None = None,
        color: str | list[str] | None = None
    ) -> "Molvis":
        """
        Draw individual atoms or a list of atoms.
        
        Args:
            atoms: Single Atom object or list of Atom objects
            style: Visualization style
            atom_radius: Global atom radius scaling
            color: Optional color override
            
        Returns:
            Self for method chaining
        """
        if not isinstance(atoms, list):
            atoms = [atoms]
        
        if not atoms:
            raise ValueError("atoms list cannot be empty")
        
        x_list: list[float] = []
        y_list: list[float] = []
        z_list: list[float] = []
        element_list = []
        type_list = []
        
        for atom in atoms:
            if hasattr(atom, 'get'):
                getter = atom.get
            elif isinstance(atom, dict):
                getter = atom.get
            else:
                raise TypeError(f"Each atom must have a 'get' method or be dict-like, got {type(atom)}")
            
            element = getter('element', getter('symbol', 'C'))
            atom_type = getter('type', 1)

            xyz = getter('xyz')
            if xyz is not None:
                coords = np.asarray(xyz)
                if coords.size != 3:
                    raise ValueError("Each atom 'xyz' must contain exactly three coordinates")
                coords = coords.reshape(3)
                x_val, y_val, z_val = coords.tolist()
            else:
                x_val = getter('x')
                y_val = getter('y')
                z_val = getter('z')
                if x_val is None or y_val is None or z_val is None:
                    raise ValueError("Each atom must provide x, y, z coordinates or an 'xyz' vector")
            
            x_list.append(float(x_val))
            y_list.append(float(y_val))
            z_list.append(float(z_val))
            element_list.append(element)
            type_list.append(str(atom_type))
        
        atoms_block = {
            'x': np.array(x_list),
            'y': np.array(y_list),
            'z': np.array(z_list),
            'element': np.array(element_list),
            'type': np.array(type_list)
        }
        
        if color is not None:
            if isinstance(color, str):
                color = [color] * len(atoms)
            atoms_block['color'] = np.array(color)
        
        frame = mp.Frame(blocks={'atoms': atoms_block})
        
        return self.draw_frame(
            frame=frame,
            style=style,
            atom_radius=atom_radius,
            bond_radius=0.0
        )

    def clear(self: "Molvis") -> "Molvis":
        """
        Clear all content from the current shared frontend session.

        Raises:
            molvis.MolvisRpcError: If the frontend rejects the command.
        """
        self.send_cmd(
            FrontendCommands.CLEAR.method,
            {},
            wait_for_response=True,
        )
        return self

    def set_style(
        self: "Molvis",
        style: Literal["ball_and_stick", "spacefill", "wireframe"] = "ball_and_stick",
        atom_radius: float | list[float] | None = None,
        bond_radius: float | None = None
    ) -> "Molvis":
        """
        Set global visualization style parameters for the current session.

        Raises:
            molvis.MolvisRpcError: If style validation or redraw fails.
        """
        params = {
            "style": style,
            "atoms": {"radius": atom_radius},
            "bonds": {"radius": bond_radius}
        }
        self.send_cmd(
            FrontendCommands.SET_STYLE.method,
            params,
            wait_for_response=True,
        )
        return self

    def set_theme(self: "Molvis", theme: str) -> "Molvis":
        """
        Set the current frontend theme.

        Raises:
            molvis.MolvisRpcError: If the frontend rejects the theme.
        """
        self.send_cmd(
            FrontendCommands.SET_THEME.method,
            {"theme": theme},
            wait_for_response=True,
        )
        return self

    def set_view_mode(self: "Molvis", mode: str) -> "Molvis":
        """
        Set camera interaction mode.

        Raises:
            molvis.MolvisRpcError: If the frontend rejects the mode.
        """
        self.send_cmd(
            FrontendCommands.SET_VIEW_MODE.method,
            {"mode": mode},
            wait_for_response=True,
        )
        return self
