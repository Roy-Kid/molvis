"""
Binary-payload codecs shared by all transports.

* :class:`BinaryPayloadEncoder` / :class:`BinaryPayloadDecoder` lift
  :class:`numpy.ndarray` out of a nested payload into separate binary
  buffers (referenced in JSON via the ``__molvis_buffer__`` marker) so
  dense numeric data does not have to round-trip through JSON.
* :func:`encode_binary_frame` / :func:`decode_binary_frame` pack those
  buffers together with the JSON envelope into a single WebSocket frame.
"""

from __future__ import annotations

import dataclasses
import json
import struct
import sys
from dataclasses import asdict
from typing import Any

import numpy as np

from ..types import BinaryBufferRef

__all__ = [
    "BinaryPayloadDecoder",
    "BinaryPayloadEncoder",
    "decode_binary_frame",
    "encode_binary_frame",
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
    """Decode nested payloads and reconstruct ndarrays from transport buffers."""

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


def encode_binary_frame(
    json_payload: dict[str, Any],
    buffers: list[memoryview | bytes],
) -> bytes:
    """Pack a JSON-RPC envelope + binary buffers into one WebSocket frame.

    Wire format (little-endian throughout):
        [4 bytes]    uint32  buffer_count (N)
        [N*8 bytes]  N pairs of (uint32 offset, uint32 length)
        [variable]   JSON payload as UTF-8
        [variable]   concatenated buffer bytes

    Offsets are relative to the start of the buffer data section
    (immediately after the JSON section).
    """
    json_bytes = json.dumps(json_payload).encode("utf-8")
    buffer_count = len(buffers)

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

    struct.pack_into("<I", out, pos, buffer_count)
    pos += 4

    for buf_offset, buf_length in offset_table:
        struct.pack_into("<I", out, pos, buf_offset)
        pos += 4
        struct.pack_into("<I", out, pos, buf_length)
        pos += 4

    out[pos : pos + len(json_bytes)] = json_bytes
    pos += len(json_bytes)

    for buf in buffers:
        buf_bytes = bytes(buf)
        out[pos : pos + len(buf_bytes)] = buf_bytes
        pos += len(buf_bytes)

    return bytes(out)


def decode_binary_frame(data: bytes) -> tuple[dict[str, Any], list[bytes]]:
    """Decode a binary frame into ``(json_dict, [buffer_bytes])``."""
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

    header_size = 4 + buffer_count * 8
    total_buffer_size = sum(length for _, length in offset_table)
    json_end = len(data) - total_buffer_size
    json_bytes = data[header_size:json_end]
    json_payload = json.loads(json_bytes.decode("utf-8"))

    buffer_data_start = json_end
    buffers: list[bytes] = []
    for buf_offset, buf_length in offset_table:
        start = buffer_data_start + buf_offset
        buffers.append(data[start : start + buf_length])

    return json_payload, buffers
