"""
MolVis - Molecular visualization for Python.

Standalone viewer (like matplotlib.pyplot.show)::

    import molvis as mv
    mv.show(frame)                    # canvas only, blocks
    mv.show(frame, mode="page")       # full UI with sidebars

    viewer = mv.show(frame, block=False)
    viewer.set_style(style="spacefill")
    viewer.close()

Jupyter widget::

    scene = mv.Molvis(name="protein_view", width=800, height=600)
    scene.draw_frame(frame)
    scene  # display inline
"""

from .errors import MolvisRpcError
from .palettes import (
    PaletteDefinition,
    PaletteEntry,
    PaletteInfo,
    render_palette_preview,
    save_palette_preview_bytes,
)
from .scene import Molvis
from .standalone import StandaloneMolvis, show
from .utils import NumpyEncoder

__all__ = [
    "Molvis",
    "MolvisRpcError",
    "NumpyEncoder",
    "PaletteDefinition",
    "PaletteEntry",
    "PaletteInfo",
    "render_palette_preview",
    "save_palette_preview_bytes",
    "StandaloneMolvis",
    "show",
]
__version__ = "0.0.1"
