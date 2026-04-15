"""Standalone MolVis viewer that opens in a browser window."""

from __future__ import annotations

import atexit
import logging
import webbrowser
from typing import Any, Literal

from .commands import (
    DrawingCommandsMixin,
    FrameCommandsMixin,
    PaletteCommandsMixin,
    SelectionCommandsMixin,
    SnapshotCommandsMixin,
)
from .errors import MolvisRpcError
from .server import MolvisServer

logger = logging.getLogger("molvis")

__all__ = ["StandaloneMolvis", "show"]

ViewerMode = Literal["core", "page"]


class StandaloneMolvis(
    DrawingCommandsMixin,
    FrameCommandsMixin,
    SelectionCommandsMixin,
    SnapshotCommandsMixin,
    PaletteCommandsMixin,
):
    """A MolVis viewer that runs in a browser window.

    Unlike :class:`Molvis` (which requires Jupyter), this class starts a
    local HTTP + WebSocket server and opens the default browser.  The
    same command API (``draw_frame``, ``set_style``, ``snapshot``, etc.)
    is available after calling :meth:`show`.

    Args:
        mode: ``"core"`` for canvas-only (fast, minimal) or ``"page"``
            for the full UI with sidebars, timeline, and analysis tools.
        width: Viewer width in pixels.
        height: Viewer height in pixels.

    Example::

        viewer = StandaloneMolvis(mode="core")
        viewer.show(block=False)
        viewer.draw_frame(frame)
        viewer.close()
    """

    def __init__(
        self,
        mode: ViewerMode = "core",
        width: int = 1200,
        height: int = 800,
    ) -> None:
        self.mode = mode
        self.width = width
        self.height = height
        self._server: MolvisServer | None = None
        self._shown = False
        atexit.register(self.close)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def show(self, block: bool = True) -> "StandaloneMolvis":
        """Open the viewer in the default browser.

        Args:
            block: If True (default), block until the browser tab is
                closed. If False, return immediately so the caller can
                send additional commands.

        Returns:
            Self, for method chaining.
        """
        if self._shown:
            logger.warning("Viewer is already open")
            return self

        server = MolvisServer()
        port = server.start()
        self._server = server

        params = "ws=1&minimal=1" if self.mode == "core" else "ws=1"
        url = f"http://localhost:{port}?{params}"
        logger.info("Opening MolVis viewer at %s", url)
        webbrowser.open(url)

        server.wait_for_connection(timeout=30)
        self._shown = True

        if block:
            self._block_until_closed()

        return self

    def _block_until_closed(self) -> None:
        """Block until the browser tab is closed, then clean up."""
        try:
            if self._server is not None:
                self._server.wait_for_disconnection()
        finally:
            self.close()

    def close(self) -> None:
        """Stop the server and clean up."""
        if self._server is not None:
            self._server.stop()
            self._server = None
        self._shown = False

    # ------------------------------------------------------------------
    # Command interface (matches Molvis.send_cmd signature)
    # ------------------------------------------------------------------

    def send_cmd(
        self,
        method: str,
        params: dict[str, Any],
        buffers: list[Any] | None = None,
        wait_for_response: bool = False,
        timeout: float = 10.0,
    ) -> Any:
        """Send a command to the browser viewer.

        This has the same signature as :meth:`Molvis.send_cmd` so that
        the command mixins work identically in both Jupyter and
        standalone mode.
        """
        if self._server is None:
            raise RuntimeError(
                "Viewer is not open. Call show() before sending commands."
            )

        transport = self._server.transport
        response = transport.send_request(
            method,
            params,
            buffers=buffers,
            wait_for_response=True,
            timeout=timeout,
        )

        if isinstance(response, dict) and "error" in response:
            error = response["error"] or {}
            raise MolvisRpcError(
                method=method,
                code=int(error.get("code", -32603)),
                message=str(error.get("message", "Unknown frontend error")),
                data=error.get("data"),
                request_id=response.get("id"),
            )
        if isinstance(response, dict) and "result" in response:
            return response["result"]
        return response

    # ------------------------------------------------------------------
    # Context manager support
    # ------------------------------------------------------------------

    def __enter__(self) -> "StandaloneMolvis":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()


def show(
    frame: Any = None,
    *,
    mode: ViewerMode = "core",
    block: bool = True,
    width: int = 1200,
    height: int = 800,
) -> StandaloneMolvis:
    """Open a standalone MolVis viewer, optionally with an initial frame.

    This is the high-level convenience function for quick visualization,
    modelled after ``matplotlib.pyplot.show()``.

    Args:
        frame: A ``molpy.Frame`` to display immediately. If *None*, the
            viewer opens empty.
        mode: ``"core"`` for canvas-only (fast, minimal) or ``"page"``
            for the full UI with sidebars and analysis tools.
        block: If True (default), block until the browser tab is closed.
        width: Viewer width in pixels.
        height: Viewer height in pixels.

    Returns:
        The :class:`StandaloneMolvis` instance. In non-blocking mode
        this can be used to send further commands.

    Example::

        import molvis as mv
        import molpy as mp

        frame = mp.Frame(...)
        mv.show(frame)                    # canvas-only, blocks
        mv.show(frame, mode="page")       # full UI
    """
    viewer = StandaloneMolvis(mode=mode, width=width, height=height)
    viewer.show(block=False)

    if frame is not None:
        viewer.draw_frame(frame)

    if block:
        viewer._block_until_closed()

    return viewer
