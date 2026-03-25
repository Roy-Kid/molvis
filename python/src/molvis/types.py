from dataclasses import dataclass
from typing import Dict, Any, Optional

@dataclass
class JsonRPCRequest:
    jsonrpc: str
    id: int
    method: str
    params: Dict[str, Any]

@dataclass
class JsonRPCResponse:
    jsonrpc: str
    id: int
    result: Optional[Dict[str, Any]]
    error: Optional[Dict[str, Any]]