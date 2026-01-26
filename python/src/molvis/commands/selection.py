#!/usr/bin/env python3
"""
Selection commands for MolVis widget.

These methods are mixed into the Molvis class to provide selection query capabilities.
"""

from __future__ import annotations

import logging

import molpy as mp

logger = logging.getLogger("molvis")

__all__ = ["SelectionCommandsMixin"]


class SelectionCommandsMixin:
    """Mixin class providing selection query commands for Molvis widget."""

    def get_selected(
        self,
        timeout: float = 5.0
    ) -> mp.Frame:
        """
        Get currently selected atoms and bonds as a molpy.Frame.
        
        This method queries the frontend for the current selection state in Select mode
        and returns a molpy.Frame containing the selected entities.
        
        Args:
            timeout: Maximum time to wait for response in seconds (default: 5.0)
            
        Returns:
            molpy.Frame with 'atoms' and 'bonds' blocks containing selected entities
            
        Raises:
            TimeoutError: If the frontend does not respond within the timeout
            
        Example:
            >>> scene = Molvis()
            >>> scene.draw_frame(frame)
            >>> # User selects atoms in Select mode
            >>> selected = scene.get_selected()
            >>> print(selected.blocks['atoms']['element'])
            ['C', 'N', 'O', ...]
        """
        response = self.send_cmd("get_selected", {}, wait_for_response=True, timeout=timeout)
        
        # Extract result from JSON-RPC response
        if isinstance(response, dict) and "result" in response:
            data = response["result"]
        else:
            data = response
        
        # Construct molpy.Frame from the response
        blocks = {}
        
        # Add atoms block if there are selected atoms
        if data.get("atoms") and len(data["atoms"].get("x", [])) > 0:
            blocks["atoms"] = data["atoms"]
        
        # Add bonds block if there are selected bonds
        if data.get("bonds") and len(data["bonds"].get("bondId", [])) > 0:
            blocks["bonds"] = data["bonds"]
        
        return mp.Frame(blocks=blocks)
