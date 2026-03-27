"""
MolVis - Jupyter widget for molecular visualization.

Usage:
    >>> import molvis as mv
    >>> import molpy as mp
    >>>
    >>> # Create a widget handle and shared frontend session
    >>> scene = mv.Molvis(
    ...     name="protein_view",
    ...     session="protein_session",
    ...     width=800,
    ...     height=600,
    ... )
    >>>
    >>> # Draw a frame
    >>> frame = mp.Frame(...)
    >>> scene.draw_frame(frame)
    >>>
    >>> # Retrieve scene by name
    >>> scene = mv.Molvis.get_scene("protein_view")
    >>>
    >>> # Catch frontend JSON-RPC failures in Python
    >>> try:
    ...     scene.set_view_mode("view")
    ... except mv.MolvisRpcError:
    ...     pass
"""

from .errors import MolvisRpcError
from .scene import Molvis
from .utils import NumpyEncoder

__all__ = ["Molvis", "MolvisRpcError", "NumpyEncoder"]
__version__ = "0.0.2"
