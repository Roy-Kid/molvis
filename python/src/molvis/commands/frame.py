#!/usr/bin/env python3
"""
Frame I/O commands for MolVis.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

import molpy as mp

if TYPE_CHECKING:
    from ..scene import Molvis

logger = logging.getLogger("molvis")

__all__ = ["FrameCommandsMixin"]


class FrameCommandsMixin:
    """Mixin class providing frame I/O commands for Molvis widget."""

    def dump_frame(self, timeout: float = 5.0) -> mp.Frame:
        """
        Dump the current scene frame.
        
        This retrieves the current atom and bond data from the frontend and returns it as a molpy.Frame.
        
        Args:
            timeout: Maximum time to wait for response in seconds (default: 5.0)
            
        Returns:
            molpy.Frame containing the scene content
            
        Raises:
            TimeoutError: If the frontend does not respond within the timeout
        """
        response = self.send_cmd("dump_frame", {}, wait_for_response=True, timeout=timeout)
        
        # Extract result from JSON-RPC response
        if isinstance(response, dict) and "result" in response:
            data = response["result"]
        else:
            data = response
            
        if not isinstance(data, dict) or "frameData" not in data:
             logger.warning(f"Unexpected response format from dump_frame: {data}")
             return mp.Frame()

        frame_data = data["frameData"]
        blocks = frame_data.get("blocks", {})
        metadata = frame_data.get("metadata", {})
        
        return mp.Frame(blocks=blocks, metadata=metadata)
