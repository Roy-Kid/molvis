"""
MolVis — molecular visualization for Python.

Single entry point
------------------

    import molvis as mv

    viewer = mv.Molvis()                  # plain script: opens a browser tab
    viewer.draw_frame(frame)
    viewer.snapshot()

    scene = mv.Molvis(name="protein")     # Jupyter cell: displays as iframe
    scene

Both hosts drive the same page bundle over a local WebSocket. See
:mod:`molvis.events` for the bidirectional event API
(:meth:`Molvis.on`, :meth:`Molvis.wait_for`, :attr:`Molvis.selection`,
:attr:`Molvis.current_mode`, …) and :mod:`molvis.transport` for
configuring the transport explicitly (CDN-hosted page, custom port, …).
"""

from .errors import MolvisRpcError
from .events import EventBus, EventHandle, Selection, ViewerState
from .palettes import (
    PaletteDefinition,
    PaletteEntry,
    PaletteInfo,
    render_palette_preview,
    save_palette_preview_bytes,
)
from .scene import Molvis
from .transport import Transport, WebSocketTransport
from .utils import NumpyEncoder

__all__ = [
    "EventBus",
    "EventHandle",
    "Molvis",
    "MolvisRpcError",
    "NumpyEncoder",
    "PaletteDefinition",
    "PaletteEntry",
    "PaletteInfo",
    "Selection",
    "Transport",
    "ViewerState",
    "WebSocketTransport",
    "render_palette_preview",
    "save_palette_preview_bytes",
]
__version__ = "0.0.1"
