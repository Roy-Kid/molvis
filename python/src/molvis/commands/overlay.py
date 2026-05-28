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

    def mark_atom(
        self: "Molvis",
        anchor_atom: int,
        *,
        shape_color: str | None = None,
        shape_opacity: float | None = None,
        shape_radius: float | None = None,
        no_shape: bool = False,
        label: str | None = None,
        label_color: str | None = None,
        label_font_size: int | None = None,
        label_background: str | None = None,
        label_offset: Vec3 | None = None,
        name: str | None = None,
    ) -> "Molvis":
        """
        Mark a specific atom with a halo and/or a text label.

        A "mark" is a composite overlay: an optional translucent sphere
        plus an optional billboarded text label, managed as a single unit
        with a single id and pinned to its atom across trajectory frames.

        Identity is **always** by atom id — never by world coordinates.
        A mark anchored to a coordinate would float in space when the
        trajectory advances, defeating the purpose of marking *an atom*.
        Use :meth:`annotate` for free-floating coordinate-anchored text.

        The shape defaults to an amber sphere — pass ``no_shape=True`` to
        disable it (e.g. for a label-only mark). The label is disabled
        unless ``label`` is set.

        Args:
            anchor_atom: Atom index to follow across frames. Required;
                must be a non-negative integer.
            shape_color: CSS hex (default ``"#ffd54a"``).
            shape_opacity: 0–1 (default ``0.35``).
            shape_radius: World units (default ``0.6``).
            no_shape: Skip the halo entirely (label-only mark).
            label: Label text. ``None`` → no label.
            label_color: CSS color (default ``"white"``).
            label_font_size: Pixels (default ``14``).
            label_background: CSS color, or ``None`` for transparent.
            label_offset: ``[dx, dy, dz]`` from the mark center.
            name: Optional display name.

        Returns:
            Self for method chaining. Use ``send_cmd`` with
            ``wait_for_response=True`` if you need the assigned id back.
        """
        if not isinstance(anchor_atom, (int, np.integer)) or int(anchor_atom) < 0:
            raise ValueError(
                f"mark_atom: anchor_atom must be a non-negative integer, "
                f"got {anchor_atom!r}"
            )

        params: dict = {"anchorAtomId": int(anchor_atom)}

        if no_shape:
            params["shape"] = None
        else:
            shape: dict = {}
            if shape_color is not None:
                shape["color"] = shape_color
            if shape_opacity is not None:
                shape["opacity"] = shape_opacity
            if shape_radius is not None:
                shape["radius"] = shape_radius
            if shape:
                params["shape"] = shape

        if label is not None:
            label_spec: dict = {"text": label}
            if label_color is not None:
                label_spec["color"] = label_color
            if label_font_size is not None:
                label_spec["fontSize"] = label_font_size
            if label_background is not None:
                label_spec["background"] = label_background
            if label_offset is not None:
                label_spec["offset"] = list(label_offset)
            params["label"] = label_spec

        if name is not None:
            params["name"] = name

        self.send_cmd(FrontendCommands.MARK_ATOM.method, params)
        return self

    def unmark_atom(self: "Molvis", mark_id: str) -> "Molvis":
        """
        Remove a mark by id. No-ops if ``mark_id`` does not exist.

        Args:
            mark_id: The id returned when the mark was created (e.g.
                ``"mark_atom_3"``).

        Returns:
            Self for method chaining.
        """
        self.send_cmd(FrontendCommands.UNMARK_ATOM.method, {"id": mark_id})
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
