from __future__ import annotations

import dataclasses
import json
import logging
import sys
import threading
from dataclasses import asdict
from queue import Empty, Queue
from typing import Any

import numpy as np

from .types import BinaryBufferRef, JsonRPCRequest

logger = logging.getLogger("molvis")

__all__ = [
    "BinaryPayloadDecoder",
    "BinaryPayloadEncoder",
    "RpcTransport",
]


def _normalize_numeric_array(array: np.ndarray) -> np.ndarray:
    """Convert arrays to contiguous little-endian payloads for JS typed arrays."""
    normalized = np.asarray(array)
    if normalized.ndim == 0:
        return normalized.reshape(1)
    if normalized.dtype.byteorder == ">" or (
        normalized.dtype.byteorder == "=" and sys.byteorder == "big"
    ):
        normalized = normalized.astype(normalized.dtype.newbyteorder("<"), copy=False)
    return np.ascontiguousarray(normalized)


class BinaryPayloadEncoder:
    """Encode nested payloads and move numeric ndarrays into binary buffers."""

    def __init__(self) -> None:
        self.buffers: list[memoryview] = []
        self._owners: list[np.ndarray] = []

    def encode(self, value: Any) -> Any:
        if dataclasses.is_dataclass(value):
            return self.encode(asdict(value))

        if isinstance(value, np.ndarray):
            return self._encode_ndarray(value)

        if isinstance(value, np.generic):
            return value.item()

        if isinstance(value, dict):
            return {str(key): self.encode(item) for key, item in value.items()}

        if isinstance(value, (list, tuple)):
            return [self.encode(item) for item in value]

        return value

    def _encode_ndarray(self, array: np.ndarray) -> Any:
        if array.ndim == 0:
            return array.item()

        if array.dtype.kind in {"O", "S", "U"}:
            return array.tolist()

        normalized = _normalize_numeric_array(array)
        ref = BinaryBufferRef(
            index=len(self.buffers),
            dtype=normalized.dtype.str,
            shape=tuple(int(dim) for dim in normalized.shape),
        )
        self._owners.append(normalized)
        self.buffers.append(memoryview(normalized))
        return ref.to_json()


class BinaryPayloadDecoder:
    """Decode nested payloads and reconstruct ndarrays from widget buffers."""

    def decode(self, value: Any, buffers: list[Any] | None = None) -> Any:
        if buffers is None:
            buffers = []

        if isinstance(value, (bytes, bytearray)):
            text = bytes(value).decode("utf-8")
            stripped = text.lstrip()
            if stripped.startswith("{") or stripped.startswith("["):
                return self.decode(json.loads(text), buffers)
            return text

        if isinstance(value, str):
            stripped = value.lstrip()
            if stripped.startswith("{") or stripped.startswith("["):
                return self.decode(json.loads(value), buffers)
            return value

        if BinaryBufferRef.is_buffer_ref(value):
            return self._decode_ndarray(BinaryBufferRef.from_json(value), buffers)

        if isinstance(value, dict):
            return {str(key): self.decode(item, buffers) for key, item in value.items()}

        if isinstance(value, list):
            return [self.decode(item, buffers) for item in value]

        return value

    def _decode_ndarray(
        self, ref: BinaryBufferRef, buffers: list[Any]
    ) -> np.ndarray:
        if ref.index >= len(buffers):
            raise IndexError(
                f"Binary payload references buffer {ref.index}, "
                f"but only {len(buffers)} buffer(s) were provided."
            )

        raw = memoryview(buffers[ref.index]).cast("B")
        array = np.frombuffer(raw, dtype=np.dtype(ref.dtype))
        if ref.shape:
            return array.reshape(ref.shape)
        return array


class RpcTransport:
    """JSON-RPC transport over anywidget custom messages."""

    def __init__(self, widget: Any) -> None:
        self._widget = widget
        self._decoder = BinaryPayloadDecoder()
        self._response_lock = threading.Lock()
        self._request_counter = 0
        self._responses: dict[int, Queue[dict[str, Any]]] = {}

    def send_request(
        self,
        method: str,
        params: dict[str, Any],
        *,
        buffers: list[Any] | None = None,
        wait_for_response: bool = False,
        timeout: float = 5.0,
    ) -> dict[str, Any] | None:
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
        self._widget.send(asdict(request), buffers=payload_buffers)

        if not wait_for_response or response_queue is None:
            return None

        try:
            return response_queue.get(timeout=timeout)
        except Empty:
            raise TimeoutError(
                f"No response from frontend for '{method}' after {timeout}s. "
                "Ensure the widget is displayed and the frontend session is ready."
            ) from None
        finally:
            with self._response_lock:
                self._responses.pop(request_id, None)

    def handle_response(self, content: Any, buffers: list[Any] | None = None) -> bool:
        """Process a frontend response.

        Returns True if the response was delivered to a waiting caller,
        False otherwise (fire-and-forget command or no matching waiter).
        """
        try:
            response = self._decoder.decode(content, buffers or [])
            if not isinstance(response, dict):
                logger.warning("Unexpected RPC response type: %s", type(response))
                return False

            request_id = response.get("id")
            if request_id is None:
                logger.debug("Ignoring RPC message without request id")
                return False

            queue: Queue[dict[str, Any]] | None = None
            with self._response_lock:
                queue = self._responses.get(int(request_id))

            if queue is None:
                logger.debug("No waiter registered for request id %s", request_id)
                return False

            queue.put_nowait(response)
            return True
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Failed to handle frontend response: %s", exc)
            return False
