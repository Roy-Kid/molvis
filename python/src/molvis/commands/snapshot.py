#!/usr/bin/env python3
"""
Snapshot commands for MolVis.
"""

from __future__ import annotations

import base64
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..scene import Molvis

logger = logging.getLogger("molvis")

__all__ = ["SnapshotCommandsMixin"]


class SnapshotCommandsMixin:
    """Mixin class providing snapshot commands for Molvis widget."""

    def snapshot(self, timeout: float = 5.0) -> bytes:
        """
        Take a snapshot of the current view.
        
        Returns:
            PNG image data as bytes.
            
        Args:
            timeout: Maximum time to wait for response in seconds (default: 5.0)
            
        Returns:
            bytes containing the PNG image data
            
        Raises:
            TimeoutError: If the frontend does not respond within the timeout
        """
        response = self.send_cmd("take_snapshot", {}, wait_for_response=True, timeout=timeout)
        
        # Extract result from JSON-RPC response
        if isinstance(response, dict) and "result" in response:
            data = response["result"]
        else:
            data = response
            
        if not isinstance(data, dict) or "data" not in data:
            raise ValueError(f"Unexpected response format from take_snapshot: {data}")

        base64_str = data["data"]
        # Remove header if present (e.g. "data:image/png;base64,")
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]
            
        return base64.b64decode(base64_str)
