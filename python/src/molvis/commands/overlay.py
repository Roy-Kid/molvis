"""Overlay drawing commands for MolVis widget."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Sequence

import numpy as np

from .catalog import FrontendCommands

if TYPE_CHECKING:
    from ..scene import Molvis

logger = logging.getLogger("molvis")

__all__ = ["OverlayCommandsMixin"]

Vec3 = Sequence[float]


class OverlayCommandsMixin:
    """Mixin providing overlay annotation commands for Molvis widget."""

    def draw_arrow(
        self: "Molvis",
        start: Vec3,
        end: Vec3,
        *,
        color: str = "#ff4444",
        opacity: float = 1.0,
        shaft_radius: float = 0.1,
        head_ratio: float = 0.25,
        name: str | None = None,
    ) -> "Molvis":
        """
        Draw a 3D arrow in world space.

        Args:
            start: Arrow tail position ``[x, y, z]``.
            end: Arrow tip position ``[x, y, z]``.
            color: CSS hex color, e.g. ``"#ff4444"``.
            opacity: 0–1 transparency.
            shaft_radius: Cylinder radius in world units.
            head_ratio: Head length / total length.
            name: Optional display name.

        Returns:
            Self for method chaining.
        """
        self.send_cmd(
            FrontendCommands.ADD_OVERLAY.method,
            {
                "type": "arrow3d",
                "from": list(start),
                "to": list(end),
                "color": color,
                "opacity": opacity,
                "shaftRadius": shaft_radius,
                "headRatio": head_ratio,
                "name": name,
            },
        )
        return self

    def draw_arrow2d(
        self: "Molvis",
        start: Vec3,
        end: Vec3,
        *,
        color: str = "#4488ff",
        stroke_width: float = 0.02,
        head_size: float = 0.15,
        dashed: bool = False,
        billboard: bool = False,
        label: str | None = None,
    ) -> "Molvis":
        """
        Draw a flat (line-based) arrow in world space.

        Unlike ``draw_arrow``, this renders as a line + arrowhead rather
        than a solid 3D cylinder, making it suitable for schematic overlays.

        Args:
            start: Arrow tail position ``[x, y, z]``.
            end: Arrow tip position ``[x, y, z]``.
            color: CSS hex color.
            stroke_width: Line width in world units.
            head_size: Arrowhead size factor.
            dashed: Render as dashed line.
            billboard: Always face camera.
            label: Optional text label alongside arrow.

        Returns:
            Self for method chaining.
        """
        self.send_cmd(
            FrontendCommands.ADD_OVERLAY.method,
            {
                "type": "arrow2d",
                "from": list(start),
                "to": list(end),
                "color": color,
                "strokeWidth": stroke_width,
                "headSize": head_size,
                "dashed": dashed,
                "billboard": billboard,
                "label": label,
            },
        )
        return self

    def annotate(
        self: "Molvis",
        position: Vec3,
        text: str,
        *,
        color: str = "white",
        font_size: int = 14,
        background: str | None = None,
        billboard: bool = True,
        anchor_atom: int | None = None,
        offset: Vec3 | None = None,
    ) -> "Molvis":
        """
        Place a text label at a world-space position.

        Args:
            position: World coordinates ``[x, y, z]``.
            text: Label text.
            color: Text color (CSS).
            font_size: Font size in pixels.
            background: Background fill color, or ``None`` for transparent.
            billboard: Keep label facing the camera.
            anchor_atom: Atom index to pin label to (follows frame updates).
            offset: Optional ``[dx, dy, dz]`` offset from ``anchor_atom``.

        Returns:
            Self for method chaining.
        """
        params: dict = {
            "type": "text_label",
            "position": list(position),
            "text": text,
            "color": color,
            "fontSize": font_size,
            "billboard": billboard,
        }
        if background is not None:
            params["background"] = background
        if anchor_atom is not None:
            params["anchorAtomId"] = anchor_atom
        if offset is not None:
            params["offset"] = list(offset)

        self.send_cmd(FrontendCommands.ADD_OVERLAY.method, params)
        return self

    def draw_vector_field(
        self: "Molvis",
        positions: "np.ndarray",
        vectors: "np.ndarray",
        *,
        scale: float = 1.0,
        color_mode: str = "magnitude",
        color: str = "#4488ff",
        max_arrows: int = 5000,
        shaft_radius: float = 0.03,
        head_ratio: float = 0.25,
    ) -> "Molvis":
        """
        Draw a vector field as a batch of arrows.

        Args:
            positions: ``(N, 3)`` float array of arrow origins.
            vectors: ``(N, 3)`` float array of direction + magnitude.
            scale: Multiplier applied to all vector lengths.
            color_mode: ``"uniform"``, ``"magnitude"``, or ``"direction"``.
            color: Color used in ``"uniform"`` mode.
            max_arrows: Maximum arrows to render (excess culled for perf).
            shaft_radius: Arrow shaft radius in world units.
            head_ratio: Head length / total length.

        Returns:
            Self for method chaining.
        """
        pos_arr = np.asarray(positions, dtype=np.float32).reshape(-1, 3)
        vec_arr = np.asarray(vectors, dtype=np.float32).reshape(-1, 3)
        if pos_arr.shape != vec_arr.shape:
            raise ValueError(
                f"positions and vectors must have the same shape, "
                f"got {pos_arr.shape} vs {vec_arr.shape}"
            )

        self.send_cmd(
            FrontendCommands.ADD_OVERLAY.method,
            {
                "type": "vector_field",
                "positions": pos_arr.flatten().tolist(),
                "vectors": vec_arr.flatten().tolist(),
                "scale": scale,
                "colorMode": color_mode,
                "color": color,
                "maxArrows": max_arrows,
                "shaftRadius": shaft_radius,
                "headRatio": head_ratio,
            },
        )
        return self

    def remove_overlay(self: "Molvis", overlay_id: str) -> "Molvis":
        """
        Remove an overlay by id.

        Args:
            overlay_id: UUID of the overlay to remove.

        Returns:
            Self for method chaining.
        """
        self.send_cmd(
            FrontendCommands.REMOVE_OVERLAY.method,
            {"id": overlay_id},
        )
        return self

    def update_overlay(
        self: "Molvis",
        overlay_id: str,
        **patch,
    ) -> "Molvis":
        """
        Update overlay properties in place.

        Args:
            overlay_id: UUID of overlay to update.
            **patch: Property key/value pairs to apply (camelCase).

        Returns:
            Self for method chaining.
        """
        self.send_cmd(
            FrontendCommands.UPDATE_OVERLAY.method,
            {"id": overlay_id, "patch": patch},
        )
        return self

    def clear_overlays(self: "Molvis") -> "Molvis":
        """Remove all overlays from the scene."""
        self.send_cmd(FrontendCommands.CLEAR_OVERLAYS.method, {})
        return self

    def mark_atom(
        self: "Molvis",
        atom_id: int,
        *,
        label: str | None = None,
        shape_color: str | None = None,
        shape_opacity: float | None = None,
        show_shape: bool = True,
        label_color: str | None = None,
        label_background: str | None = None,
        label_offset: Vec3 | None = None,
        name: str | None = None,
        wait_for_response: bool = False,
    ) -> "str | Molvis":
        """
        Mark an atom with a halo and/or text label.

        The mark is anchored to ``atom_id`` and follows that atom across
        frame updates. Halo radius and label font size are auto-sized from
        the atom's rendered radius on the frontend — pass style overrides
        only when you want to deviate from that.

        Args:
            atom_id: Atom index to mark. Must exist in the current frame.
            label: Optional text to display next to the mark.
            shape_color: CSS hex color for the halo (default amber).
            shape_opacity: Halo opacity in 0-1 (default 0.35).
            show_shape: Set ``False`` to display only the label, no halo.
            label_color: CSS color for the label text.
            label_background: Fill color behind the label, or ``None``.
            label_offset: ``[dx, dy, dz]`` offset of the label from center.
            name: Optional display name for the overlay.
            wait_for_response: When ``True``, block until the frontend
                returns the new overlay id and return that id as a string.

        Returns:
            Overlay id (``str``) when ``wait_for_response=True``,
            otherwise ``self`` for method chaining.
        """
        params: dict = {"anchorAtomId": atom_id}
        if name is not None:
            params["name"] = name

        if not show_shape:
            params["shape"] = None
        elif shape_color is not None or shape_opacity is not None:
            shape: dict = {}
            if shape_color is not None:
                shape["color"] = shape_color
            if shape_opacity is not None:
                shape["opacity"] = shape_opacity
            params["shape"] = shape

        if label is not None:
            label_props: dict = {"text": label}
            if label_color is not None:
                label_props["color"] = label_color
            if label_background is not None:
                label_props["background"] = label_background
            if label_offset is not None:
                label_props["offset"] = list(label_offset)
            params["label"] = label_props

        result = self.send_cmd(
            FrontendCommands.MARK_ATOM.method,
            params,
            wait_for_response=wait_for_response,
        )
        if wait_for_response and isinstance(result, dict):
            return str(result.get("id", ""))
        return self

    def unmark_atom(self: "Molvis", overlay_id: str) -> "Molvis":
        """
        Remove a mark by id.

        Args:
            overlay_id: The id returned by a prior ``mark_atom`` call
                (when invoked with ``wait_for_response=True``).

        Returns:
            Self for method chaining.
        """
        self.send_cmd(
            FrontendCommands.UNMARK_ATOM.method,
            {"id": overlay_id},
        )
        return self
