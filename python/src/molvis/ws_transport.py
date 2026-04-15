"""WebSocket transport for standalone (non-Jupyter) MolVis sessions."""

from __future__ import annotations

import asyncio
import json
import logging
import struct
import threading
from dataclasses import asdict
from queue import Queue
from typing import Any

from .transport import BinaryPayloadDecoder, BinaryPayloadEncoder
from .types import JsonRPCRequest

logger = logging.getLogger("molvis")

__all__ = ["WsTransport", "encode_binary_frame", "decode_binary_frame"]


def encode_binary_frame(
    json_payload: dict[str, Any],
    buffers: list[memoryview | bytes],
) -> bytes:
    """Encode a JSON-RPC envelope + binary buffers into a single binary frame.

    Wire format:
        [4 bytes]  uint32 LE  buffer_count (N)
        [N*8 bytes] N pairs of (uint32 LE offset, uint32 LE length)
        [variable]  JSON payload as UTF-8
        [variable]  concatenated buffer bytes

    Offsets are relative to the start of the buffer data section
    (immediately after the JSON section).
    """
    json_bytes = json.dumps(json_payload).encode("utf-8")
    buffer_count = len(buffers)

    # Pre-compute buffer offsets in BYTES (not items).
    # memoryview.nbytes gives the byte count; len() gives item count.
    byte_offset = 0
    offset_table: list[tuple[int, int]] = []
    for buf in buffers:
        nbytes = buf.nbytes if hasattr(buf, "nbytes") else len(buf)
        offset_table.append((byte_offset, nbytes))
        byte_offset += nbytes

    header_size = 4 + buffer_count * 8
    total_size = header_size + len(json_bytes) + byte_offset

    out = bytearray(total_size)
    pos = 0

    # Buffer count
    struct.pack_into("<I", out, pos, buffer_count)
    pos += 4

    # Offset/length table
    for buf_offset, buf_length in offset_table:
        struct.pack_into("<I", out, pos, buf_offset)
        pos += 4
        struct.pack_into("<I", out, pos, buf_length)
        pos += 4

    # JSON payload
    out[pos : pos + len(json_bytes)] = json_bytes
    pos += len(json_bytes)

    # Buffer data
    for buf in buffers:
        buf_bytes = bytes(buf)
        out[pos : pos + len(buf_bytes)] = buf_bytes
        pos += len(buf_bytes)

    return bytes(out)


def decode_binary_frame(data: bytes) -> tuple[dict[str, Any], list[bytes]]:
    """Decode a binary frame into a JSON-RPC envelope + list of buffer bytes.

    Returns:
        A tuple of (json_dict, list_of_buffer_bytes).
    """
    pos = 0

    buffer_count = struct.unpack_from("<I", data, pos)[0]
    pos += 4

    offset_table: list[tuple[int, int]] = []
    for _ in range(buffer_count):
        buf_offset = struct.unpack_from("<I", data, pos)[0]
        pos += 4
        buf_length = struct.unpack_from("<I", data, pos)[0]
        pos += 4
        offset_table.append((buf_offset, buf_length))

    # Everything between the header and the buffer data is JSON
    header_size = 4 + buffer_count * 8
    # Buffer data starts after header + json; we need to find the json length.
    # Total buffer data size = sum of all buffer lengths
    total_buffer_size = sum(length for _, length in offset_table)
    json_end = len(data) - total_buffer_size
    json_bytes = data[header_size:json_end]
    json_payload = json.loads(json_bytes.decode("utf-8"))

    # Extract buffers
    buffer_data_start = json_end
    buffers: list[bytes] = []
    for buf_offset, buf_length in offset_table:
        start = buffer_data_start + buf_offset
        buffers.append(data[start : start + buf_length])

    return json_payload, buffers


class WsTransport:
    """JSON-RPC transport over WebSocket for standalone mode.

    Thread-safe: ``send_request`` is called from the main thread while the
    WebSocket I/O runs in the server's asyncio event loop thread.
    """

    def __init__(self) -> None:
        self._decoder = BinaryPayloadDecoder()
        self._response_lock = threading.Lock()
        self._request_counter = 0
        self._responses: dict[int, Queue[dict[str, Any]]] = {}
        self._ws: Any | None = None  # websockets connection
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind(
        self,
        ws: Any,
        loop: asyncio.AbstractEventLoop,
    ) -> None:
        """Attach the live WebSocket connection and event loop."""
        self._ws = ws
        self._loop = loop

    def unbind(self) -> None:
        """Detach the WebSocket connection."""
        self._ws = None

    @property
    def connected(self) -> bool:
        return self._ws is not None

    # ------------------------------------------------------------------
    # Outbound (main thread -> browser)
    # ------------------------------------------------------------------

    def send_request(
        self,
        method: str,
        params: dict[str, Any],
        *,
        buffers: list[Any] | None = None,
        wait_for_response: bool = False,
        timeout: float = 5.0,
    ) -> dict[str, Any] | None:
        if self._ws is None or self._loop is None:
            raise RuntimeError("WebSocket transport is not connected")

        encoder = BinaryPayloadEncoder()
        encoded_params = encoder.encode(params)

        with self._response_lock:
            self._request_counter += 1
            request_id = self._request_counter
            response_queue: Queue[dict[str, Any]] | None = None
            if wait_for_response:
                response_queue = Queue(maxsize=1)
                self._responses[request_id] = response_queue

        request = JsonRPCRequest(
            jsonrpc="2.0",
            method=method,
            params=encoded_params,
            id=request_id,
        )

        payload_buffers = [*encoder.buffers, *(buffers or [])]

        if payload_buffers:
            frame = encode_binary_frame(asdict(request), payload_buffers)
            future = asyncio.run_coroutine_threadsafe(
                self._ws.send(frame),
                self._loop,
            )
        else:
            text = json.dumps(asdict(request))
            future = asyncio.run_coroutine_threadsafe(
                self._ws.send(text),
                self._loop,
            )

        # Wait for the send to complete (or raise)
        try:
            future.result(timeout=timeout)
        except Exception:
            with self._response_lock:
                self._responses.pop(request_id, None)
            raise

        if not wait_for_response or response_queue is None:
            return None

        try:
            return response_queue.get(timeout=timeout)
        finally:
            with self._response_lock:
                self._responses.pop(request_id, None)

    # ------------------------------------------------------------------
    # Inbound (browser -> main thread)
    # ------------------------------------------------------------------

    def handle_response(self, content: Any, buffers: list[Any] | None = None) -> None:
        """Process an inbound message from the browser."""
        try:
            response = self._decoder.decode(content, buffers or [])
            if not isinstance(response, dict):
                logger.warning("Unexpected WS response type: %s", type(response))
                return

            request_id = response.get("id")
            if request_id is None:
                logger.debug("Ignoring WS message without request id")
                return

            queue: Queue[dict[str, Any]] | None = None
            with self._response_lock:
                queue = self._responses.get(int(request_id))

            if queue is None:
                logger.debug("No waiter for request id %s", request_id)
                return

            queue.put_nowait(response)
        except Exception as exc:
            logger.warning("Failed to handle WS response: %s", exc)
