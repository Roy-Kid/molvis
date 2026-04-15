"""Drawing and visualization commands for MolVis widget."""

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

    def new_frame(
        self: "Molvis",
        name: str | None = None,
        clear: bool = True,
    ) -> "Molvis":
        """Create a new frame and set it as current."""
        self.send_cmd(FrontendCommands.NEW_FRAME.method, {"name": name, "clear": clear})
        return self

    def draw_frame(
        self: "Molvis",
        frame: mp.Frame,
        style: Literal["ball_and_stick", "spacefill", "wireframe"] = "ball_and_stick",
        atom_radius: float | list[float] | None = None,
        bond_radius: float | None = None,
        include_metadata: bool = False,
        color_by: str | None = None,
        colormap: str = "viridis",
    ) -> "Molvis":
        """
        Draw a molecular frame on the current canvas.

        Passes molpy Frame data directly to the frontend.  Numeric arrays
        are sent as binary buffers via the transport encoder.

        Args:
            frame: molpy Frame object containing blocks (atoms, bonds, etc.)
            style: Visualization style
            atom_radius: Global atom radius scaling or per-atom radii list
            bond_radius: Global bond radius
            include_metadata: Whether to include frame metadata
            color_by: Column name to color atoms by for this draw call.
                Does not change the scene's global color mode.
            colormap: Backward-compatible numeric ramp hint. Numeric columns
                currently use ``viridis``; string columns use the fixed
                ``glasbey-vivid`` categorical palette.

        Returns:
            Self for method chaining
        """
        frame_data = frame.to_dict()

        draw_data: dict[str, Any] = {"blocks": frame_data["blocks"]}
        if include_metadata and "metadata" in frame_data:
            draw_data["metadata"] = frame_data["metadata"]

        options: dict[str, Any] = {
            "atoms": {"radius": atom_radius},
            "bonds": {"radius": bond_radius},
            "style": style,
        }
        if color_by is not None:
            options["color_by"] = {"column": color_by, "colormap": colormap}

        self.send_cmd(
            FrontendCommands.DRAW_FRAME.method,
            {"frame": draw_data, "options": options},
        )
        return self

    def draw_atomistic(
        self: "Molvis",
        atomistic: Any,
        style: Literal["ball_and_stick", "spacefill", "wireframe"] = "ball_and_stick",
        atom_radius: float | list[float] | None = None,
        bond_radius: float | None = None,
        include_metadata: bool = False,
        atom_fields: list[str] | None = None,
        color_by: str | None = None,
        colormap: str = "viridis",
    ) -> "Molvis":
        """
        Draw an Atomistic object (Molecule, Residue, Crystal, etc.).

        Args:
            atomistic: molpy Atomistic object with a ``to_frame()`` method
            style: Visualization style
            atom_radius: Global atom radius scaling
            bond_radius: Global bond radius
            include_metadata: Whether to include frame metadata
            atom_fields: List of atom fields to extract
            color_by: Column name to color atoms by for this draw call.
            colormap: Backward-compatible numeric ramp hint.

        Returns:
            Self for method chaining
        """
        frame = (
            atomistic.to_frame(atom_fields=atom_fields)
            if atom_fields is not None
            else atomistic.to_frame()
        )
        return self.draw_frame(
            frame=frame,
            style=style,
            atom_radius=atom_radius,
            bond_radius=bond_radius,
            include_metadata=include_metadata,
            color_by=color_by,
            colormap=colormap,
        )

    def draw_box(
        self: "Molvis",
        box: mp.Box,
        color: str | None = None,
        line_width: float = 1.0,
        visible: bool = True,
    ) -> "Molvis":
        """Draw simulation box on current canvas."""
        self.send_cmd(
            FrontendCommands.DRAW_BOX.method,
            {
                "box": box.to_dict(),
                "options": {
                    "color": color,
                    "lineWidth": line_width,
                    "visible": visible,
                },
            },
        )
        return self

    def draw_atoms(
        self: "Molvis",
        atoms: Any | list[Any],
        style: Literal["ball_and_stick", "spacefill", "wireframe"] = "ball_and_stick",
        atom_radius: float | list[float] | None = None,
        color: str | list[str] | None = None,
    ) -> "Molvis":
        """
        Draw individual atoms or a list of atoms.

        Each atom must be dict-like (molpy Atom, plain dict, etc.) with at
        least ``symbol`` (or ``element``) and ``x``, ``y``, ``z`` coordinates.
        """
        if not isinstance(atoms, list):
            atoms = [atoms]

        symbols: list[str] = []
        x_list: list[float] = []
        y_list: list[float] = []
        z_list: list[float] = []

        for atom in atoms:
            symbols.append(atom.get("symbol", atom.get("element", "C")))
            x_list.append(float(atom.get("x")))
            y_list.append(float(atom.get("y")))
            z_list.append(float(atom.get("z")))

        atoms_block: dict[str, Any] = {
            "symbol": np.array(symbols),
            "x": np.array(x_list, dtype=np.float64),
            "y": np.array(y_list, dtype=np.float64),
            "z": np.array(z_list, dtype=np.float64),
        }

        if color is not None:
            if isinstance(color, str):
                color = [color] * len(atoms)
            atoms_block["color"] = np.array(color)

        frame = mp.Frame(blocks={"atoms": atoms_block})
        return self.draw_frame(
            frame=frame, style=style, atom_radius=atom_radius, bond_radius=0.0
        )

    def clear(self: "Molvis") -> "Molvis":
        """Clear all content from canvas."""
        self.send_cmd(FrontendCommands.CLEAR.method, {})
        return self

    def set_style(
        self: "Molvis",
        style: Literal["ball_and_stick", "spacefill", "wireframe"] = "ball_and_stick",
        atom_radius: float | list[float] | None = None,
        bond_radius: float | None = None,
    ) -> "Molvis":
        """Set global visualization style parameters."""
        self.send_cmd(
            FrontendCommands.SET_STYLE.method,
            {
                "style": style,
                "atoms": {"radius": atom_radius},
                "bonds": {"radius": bond_radius},
            },
        )
        return self

    def set_theme(self: "Molvis", theme: str) -> "Molvis":
        """Set color theme for molecular visualization."""
        self.send_cmd(FrontendCommands.SET_THEME.method, {"theme": theme})
        return self

    def set_background(self: "Molvis", color: str) -> "Molvis":
        """
        Set background color.

        Args:
            color: ``#RRGGBB`` (opaque) or ``#RRGGBBAA`` (with alpha).
                Examples: ``"#FFFFFF"`` white, ``"#00000000"`` transparent.

        Returns:
            Self for method chaining
        """
        self.send_cmd(FrontendCommands.SET_BACKGROUND.method, {"color": color})
        return self

    def color_by(
        self: "Molvis",
        column: str | None = None,
        colormap: str = "viridis",
        range: tuple[float, float] | None = None,
        clamp: bool = True,
    ) -> "Molvis":
        """
        Color atoms by a frame column.

        Args:
            column: Column name to color by (e.g. ``"type"``, ``"charge"``).
                Use ``"element"`` or ``None`` to reset to default CPK coloring.
            colormap: Backward-compatible numeric ramp hint. Numeric columns
                currently use ``viridis``; categorical columns use the fixed
                ``glasbey-vivid`` palette.
            range: ``(min, max)`` for numeric normalization. Auto-detected
                when ``None``.
            clamp: Clamp out-of-range values (True) or fade to gray (False).

        Returns:
            Self for method chaining
        """
        params: dict[str, Any] = {
            "column": column,
            "colormap": colormap,
            "clamp": clamp,
        }
        if range is not None:
            params["range"] = {"min": range[0], "max": range[1]}
        self.send_cmd(FrontendCommands.COLOR_BY.method, params)
        return self

    def set_view_mode(self: "Molvis", mode: str) -> "Molvis":
        """Set camera view mode."""
        self.send_cmd(FrontendCommands.SET_VIEW_MODE.method, {"mode": mode})
        return self
