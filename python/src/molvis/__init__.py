"""
MolVis - Jupyter widget for molecular visualization.

Usage:
    >>> import molvis as mv
    >>> import molpy as mp
    >>> 
    >>> # Create a named scene
    >>> scene = mv.Molvis(name="protein_view", width=800, height=600)
    >>> 
    >>> # Draw a frame
    >>> frame = mp.Frame(...)
    >>> scene.draw_frame(frame)
    >>>
    >>> # Retrieve scene by name
    >>> scene = mv.Molvis.get_scene("protein_view")
"""

from .scene import Molvis
from .utils import NumpyEncoder

__all__ = ["Molvis", "NumpyEncoder"]
__version__ = "0.1.0"