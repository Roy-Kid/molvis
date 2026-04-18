"""Transport layer between :class:`Molvis` and a frontend host.

Exposes:

- :class:`Transport` — Protocol every transport must satisfy.
- :class:`WebSocketTransport` — the only concrete implementation. Hosts
  the bundled page, accepts a WebSocket connection from any browser /
  iframe / notebook cell, and routes JSON-RPC 2.0 + binary buffers.
- :class:`BinaryPayloadEncoder` / :class:`BinaryPayloadDecoder` and the
  binary-frame codec functions are re-exported from :mod:`._codec` for
  tests and advanced users.
"""

from ..transport_base import Transport
from ._codec import (
    BinaryPayloadDecoder,
    BinaryPayloadEncoder,
    decode_binary_frame,
    encode_binary_frame,
)
from ._jupyter_env import detect_env, in_jupyter_kernel, resolve_endpoints
from .websocket import PageEndpoints, WebSocketTransport, resolve_dist

__all__ = [
    "BinaryPayloadDecoder",
    "BinaryPayloadEncoder",
    "PageEndpoints",
    "Transport",
    "WebSocketTransport",
    "decode_binary_frame",
    "detect_env",
    "encode_binary_frame",
    "in_jupyter_kernel",
    "resolve_endpoints",
    "resolve_dist",
]
