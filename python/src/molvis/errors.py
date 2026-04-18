from __future__ import annotations

from typing import Any

__all__ = ["MolvisRPCError"]


class MolvisRPCError(RuntimeError):
    """Frontend JSON-RPC error propagated back into Python."""

    def __init__(
        self,
        *,
        method: str,
        code: int,
        message: str,
        data: Any = None,
        request_id: int | None = None,
    ) -> None:
        super().__init__(f"{method} failed ({code}): {message}")
        self.method = method
        self.code = code
        self.data = data
        self.request_id = request_id
