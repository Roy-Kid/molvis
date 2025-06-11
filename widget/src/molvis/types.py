from dataclasses import dataclass

@dataclass
class JsonRPCRequest:
    jsonrpc: str
    id: int | None
    method: str
    params: dict[str, str]

@dataclass
class JsonRPCResponse:
    jsonrpc: str
    id: int
    result: dict[str, str] | None
    error: dict[str, str] | None
