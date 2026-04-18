#!/usr/bin/env python3
"""
Frame I/O commands for MolVis.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable, Mapping
from typing import TYPE_CHECKING, Any

import molpy as mp
import numpy as np

from .catalog import FrontendCommands

if TYPE_CHECKING:
    from ..scene import Molvis

logger = logging.getLogger("molvis")

__all__ = ["FrameCommandsMixin"]


class FrameCommandsMixin:
    """Mixin class providing frame I/O commands for Molvis widget."""

    def set_trajectory(
        self: "Molvis",
        frames: Iterable[mp.Frame],
        boxes: Iterable[mp.Box | None] | None = None,
    ) -> "Molvis":
        """Replace the viewer's trajectory with a list of frames.

        Each frame is serialized via ``frame.to_dict()`` and sent in a
        single RPC call. The frontend wraps them in a Trajectory and
        navigates to frame 0. Per-frame descriptors (for the PCATool
        sidebar) are set separately via :meth:`set_frame_labels`.

        Args:
            frames: Sequence of molpy.Frame objects.
            boxes: Optional parallel sequence of molpy.Box objects.
                ``None`` entries are allowed.

        Returns:
            Self for method chaining.
        """
        frame_list = list(frames)
        if len(frame_list) == 0:
            raise ValueError("set_trajectory requires at least one frame")

        frame_payloads: list[dict[str, Any]] = [
            {"blocks": f.to_dict().get("blocks", {})} for f in frame_list
        ]

        box_list: list[mp.Box | None] | None = None
        box_payloads: list[dict[str, Any] | None] | None = None
        if boxes is not None:
            box_list = list(boxes)
            box_payloads = [
                b.to_dict() if b is not None else None for b in box_list
            ]

        params: dict[str, Any] = {"frames": frame_payloads}
        if box_payloads is not None:
            params["boxes"] = box_payloads

        self.send_cmd(
            FrontendCommands.SET_TRAJECTORY.method,
            params,
            wait_for_response=True,
        )

        self._record_trajectory(frame_list, box_list)
        self.list_modifiers()
        return self

    def set_frame_labels(
        self: "Molvis",
        labels: Mapping[str, np.ndarray | Iterable[float]] | None,
    ) -> "Molvis":
        """Attach per-frame numeric descriptors to the current trajectory.

        The frontend exposes them to the PCATool sidebar via
        ``frame-labels-change``. Each value must be a 1D array with length
        equal to the current trajectory length. Non-finite entries are
        stored as NaN.

        Args:
            labels: Mapping of label name -> 1D numeric column. Pass
                ``None`` to clear the current labels.

        Returns:
            Self for method chaining.
        """
        if labels is None:
            self.send_cmd(FrontendCommands.SET_FRAME_LABELS.method, {"labels": None})
            return self

        encoded: dict[str, np.ndarray] = {}
        for name, column in labels.items():
            arr = np.asarray(column, dtype=np.float64)
            if arr.ndim != 1:
                raise ValueError(
                    f"labels['{name}'] must be 1D, got shape {arr.shape}"
                )
            encoded[name] = arr

        self.send_cmd(
            FrontendCommands.SET_FRAME_LABELS.method, {"labels": encoded}
        )
        return self

    def export_frame(self, timeout: float = 5.0) -> mp.Frame:
        """
        Export the current staged scene frame as a molpy.Frame.
        
        This retrieves the current atom and bond data from the frontend and returns it as a molpy.Frame.
        
        Args:
            timeout: Maximum time to wait for response in seconds (default: 5.0)
            
        Returns:
            molpy.Frame containing the scene content
            
        Raises:
            TimeoutError: If the frontend does not respond within the timeout
            molvis.MolvisRPCError: If the frontend rejects the export request
        """
        data = self.send_cmd(
            FrontendCommands.EXPORT_FRAME.method,
            {},
            wait_for_response=True,
            timeout=timeout,
        )

        if not isinstance(data, dict) or "frame" not in data:
             logger.warning(f"Unexpected response format from export_frame: {data}")
             return mp.Frame()

        frame_data = data["frame"]
        blocks = frame_data.get("blocks", {})
        metadata = frame_data.get("metadata", {})
        
        return mp.Frame(blocks=blocks, metadata=metadata)

    def dump_frame(self, timeout: float = 5.0) -> mp.Frame:
        """Backward-compatible alias for export_frame()."""
        return self.export_frame(timeout=timeout)
