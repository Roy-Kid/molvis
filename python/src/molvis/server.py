"""Standalone HTTP + WebSocket server for the MolVis viewer."""

from __future__ import annotations

import asyncio
import json
import logging
import mimetypes
import os
import pathlib
import threading
from importlib.resources import files
from typing import Any

from .ws_transport import WsTransport, decode_binary_frame

logger = logging.getLogger("molvis")

__all__ = ["MolvisServer"]

# Ensure .wasm MIME type is registered (Python 3.9+ includes it,
# but we add it defensively for older patch releases).
mimetypes.add_type("application/wasm", ".wasm")


def resolve_page_dist() -> pathlib.Path:
    """Resolve the directory containing the pre-built page app.

    ``MOLVIS_PAGE_DIST`` overrides the default package resource path,
    which is useful during development (point it at ``page/dist/``).
    """
    override = os.environ.get("MOLVIS_PAGE_DIST")
    if override:
        return pathlib.Path(override).expanduser().resolve()
    resource = files("molvis").joinpath("page_dist")
    return pathlib.Path(str(resource))


class MolvisServer:
    """Local HTTP + WebSocket server for standalone MolVis sessions.

    The server runs in a daemon thread with its own asyncio event loop.
    It serves pre-built page app static files over HTTP and provides a
    ``/ws`` WebSocket endpoint for JSON-RPC communication.
    """

    def __init__(self) -> None:
        self._port: int = 0
        self._ready = threading.Event()
        self._connected = threading.Event()
        self._disconnected = threading.Event()
        self._transport = WsTransport()
        self._thread: threading.Thread | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._ws_server: Any | None = None  # websockets Server object
        self._page_dist = resolve_page_dist()

    @property
    def port(self) -> int:
        return self._port

    @property
    def transport(self) -> WsTransport:
        return self._transport

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> int:
        """Start the server in a background thread. Returns the port."""
        if self._thread is not None:
            raise RuntimeError("Server is already running")

        self._thread = threading.Thread(
            target=self._run_loop,
            name="molvis-server",
            daemon=True,
        )
        self._thread.start()

        if not self._ready.wait(timeout=10):
            raise RuntimeError("Server failed to start within 10 seconds")

        logger.info("MolVis server listening on http://localhost:%d", self._port)
        return self._port

    def wait_for_connection(self, timeout: float = 30.0) -> None:
        """Block until a browser client connects via WebSocket."""
        if not self._connected.wait(timeout=timeout):
            raise TimeoutError(
                f"No browser connected within {timeout} seconds. "
                "Make sure the browser tab opened successfully."
            )

    def wait_for_disconnection(self, timeout: float | None = None) -> bool:
        """Block until the browser client disconnects (tab closed).

        Args:
            timeout: Maximum seconds to wait. ``None`` waits indefinitely.

        Returns:
            True if the client disconnected, False if the timeout elapsed.
        """
        return self._disconnected.wait(timeout=timeout)

    def stop(self) -> None:
        """Shut down the server and its event loop."""
        loop = self._loop
        if loop is None:
            return

        self._transport.unbind()

        # Gracefully close the WebSocket server, then stop the loop
        async def _shutdown() -> None:
            if self._ws_server is not None:
                self._ws_server.close()
                await self._ws_server.wait_closed()
            loop.stop()

        asyncio.run_coroutine_threadsafe(_shutdown(), loop)

        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None

        self._loop = None

    # ------------------------------------------------------------------
    # Internal: asyncio event loop in background thread
    # ------------------------------------------------------------------

    def _run_loop(self) -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        self._loop = loop

        try:
            loop.run_until_complete(self._start_server())
            loop.run_forever()
        except Exception:
            logger.exception("MolVis server event loop crashed")
        finally:
            loop.run_until_complete(loop.shutdown_asyncgens())
            loop.close()

    async def _start_server(self) -> None:
        try:
            import websockets
            from websockets.asyncio.server import serve
        except ImportError as exc:
            raise ImportError(
                "The 'websockets' package is required for standalone mode. "
                "Install it with: pip install 'websockets>=13.0'"
            ) from exc

        async def handler(ws: Any) -> None:
            """Handle a single WebSocket connection (only one allowed)."""
            if self._connected.is_set():
                await ws.close(1013, "Only one viewer connection is allowed")
                return

            self._transport.bind(ws, asyncio.get_running_loop())
            logger.debug("Browser WebSocket connected, waiting for ready signal")

            try:
                async for message in ws:
                    # Wait for the browser "ready" signal before accepting RPC
                    if not self._connected.is_set():
                        if self._is_ready_signal(message):
                            self._connected.set()
                            logger.debug("Browser ready — accepting commands")
                            continue
                    self._dispatch_message(message)
            except websockets.exceptions.ConnectionClosed:
                pass
            finally:
                self._transport.unbind()
                self._disconnected.set()
                logger.debug("Browser disconnected")

        async def process_request(
            connection: Any,
            request: Any,
        ) -> Any:
            """Serve static files for non-WebSocket HTTP requests."""
            from websockets.http11 import Response

            # Let WebSocket upgrade requests pass through
            path = request.path
            if path == "/ws":
                return None

            return self._serve_static(path, Response)

        ws_server = await serve(
            handler,
            "localhost",
            0,  # OS-assigned port
            process_request=process_request,
        )
        self._ws_server = ws_server

        # Read the actual bound port
        for sock in ws_server.sockets:
            addr = sock.getsockname()
            self._port = addr[1]
            break

        self._ready.set()

    def _serve_static(self, path: str, response_cls: type) -> Any:
        """Resolve a URL path to a static file and return an HTTP response."""
        from websockets.datastructures import Headers

        # Normalize path
        if path == "/" or path == "":
            path = "/index.html"

        # Security: prevent path traversal
        try:
            requested = (self._page_dist / path.lstrip("/")).resolve()
            if not str(requested).startswith(str(self._page_dist.resolve())):
                return response_cls(403, "Forbidden", Headers())
        except (ValueError, OSError):
            return response_cls(400, "Bad Request", Headers())

        if not requested.is_file():
            # Try index.html for SPA routing
            index = self._page_dist / "index.html"
            if index.is_file():
                requested = index
            else:
                return response_cls(404, "Not Found", Headers())

        content_type, _ = mimetypes.guess_type(str(requested))
        if content_type is None:
            content_type = "application/octet-stream"

        try:
            body = requested.read_bytes()
        except OSError:
            return response_cls(500, "Internal Server Error", Headers())

        headers = websockets_response_headers(content_type, len(body))
        return response_cls(200, "OK", headers, body)

    @staticmethod
    def _is_ready_signal(message: Any) -> bool:
        """Check if the message is the browser ready handshake."""
        if not isinstance(message, str):
            return False
        try:
            data = json.loads(message)
            return isinstance(data, dict) and data.get("type") == "ready"
        except (json.JSONDecodeError, TypeError):
            return False

    def _dispatch_message(self, message: Any) -> None:
        """Route an inbound WebSocket message to the transport."""
        if isinstance(message, bytes):
            json_payload, buffers = decode_binary_frame(message)
            self._transport.handle_response(json_payload, buffers)
        elif isinstance(message, str):
            self._transport.handle_response(message)
        else:
            logger.warning("Unexpected WebSocket message type: %s", type(message))


def websockets_response_headers(
    content_type: str,
    content_length: int,
) -> dict[str, str]:
    """Build HTTP response headers for the websockets library."""
    from websockets.datastructures import Headers

    return Headers(
        {
            "Content-Type": content_type,
            "Content-Length": str(content_length),
            "Cache-Control": "no-cache",
        }
    )
