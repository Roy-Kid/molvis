"""Detect the Jupyter execution environment and resolve viewer URLs.

The page bundle is served from a port the kernel chose (the WS server in
:class:`~molvis.transport.WebSocketTransport`). For the browser to reach
both the JS assets and the WebSocket, we need an externally-routable
URL — which depends on whether we are in plain Jupyter, JupyterLab via
``jupyter-server-proxy``, Google Colab, etc.

Detection happens once per process and is cached by :func:`detect_env`.
:func:`resolve_endpoints` returns matching ``(base_url, ws_url)`` for
the current env.
"""

from __future__ import annotations

import functools
import logging
import os
from typing import Literal

logger = logging.getLogger("molvis")

JupyterEnv = Literal["colab", "jupyter_proxy", "vscode", "local"]

__all__ = [
    "JupyterEnv",
    "detect_env",
    "in_jupyter_kernel",
    "resolve_endpoints",
]


def in_jupyter_kernel() -> bool:
    """``True`` when running inside an IPython ZMQ kernel (Jupyter)."""
    try:
        from IPython import get_ipython
    except ImportError:
        return False
    ip = get_ipython()
    if ip is None:
        return False
    return ip.__class__.__name__ == "ZMQInteractiveShell"


def _has_google_colab() -> bool:
    try:
        import google.colab  # type: ignore[import-not-found]  # noqa: F401
    except ImportError:
        return False
    return True


def _has_jupyter_server_proxy() -> bool:
    """``True`` if the kernel can be reached via jupyter-server-proxy."""
    try:
        import jupyter_server_proxy  # type: ignore[import-not-found]  # noqa: F401
    except ImportError:
        return False
    return True


def _in_vscode() -> bool:
    return "VSCODE_PID" in os.environ or "VSCODE_IPC_HOOK_CLI" in os.environ


@functools.cache
def detect_env() -> JupyterEnv:
    """Return the environment kind.

    Cached per process — the result cannot change at runtime.
    """
    if not in_jupyter_kernel():
        return "local"
    if _has_google_colab():
        return "colab"
    if _has_jupyter_server_proxy():
        return "jupyter_proxy"
    if _in_vscode():
        # VSCode notebooks auto-forward localhost ports → plain URL works.
        return "vscode"
    return "local"


def _jupyter_proxy_base_url() -> str | None:
    """Return the prefix Jupyter server is mounted under, e.g.
    ``"/user/me/"``.  Falls back to ``"/"`` for local Jupyter.
    """
    base = os.environ.get("JUPYTERHUB_SERVICE_PREFIX")
    if base:
        return base if base.endswith("/") else base + "/"
    base = os.environ.get("JUPYTER_SERVER_URL")
    if base:
        return base if base.endswith("/") else base + "/"
    return None


def _colab_endpoints(port: int) -> tuple[str, str]:
    """Return Colab's proxy URLs for a kernel-side port.

    Colab exposes ``google.colab.kernel.proxyPort`` (JS-side) but the
    *Python-side* helper is ``output.serve_kernel_port_as_iframe`` — we
    still need an HTTP URL for asset loading. The standard pattern is
    ``https://<random>.colab.googleusercontent.com/proxy/<port>/`` and
    Colab injects this when ``serve_kernel_port_as_iframe`` is called.
    For now we let Colab's JS proxy handle the URL by constructing it
    directly via known pattern.
    """
    # Colab's WebSocket proxy: same host, /proxy/<port>/ path
    base = f"/proxy/{port}/"
    ws = f"wss://_/proxy/{port}/ws"  # placeholder; cell script rewrites
    return base, ws


def resolve_endpoints(host: str, port: int) -> tuple[str, str]:
    """Return ``(base_url, ws_url)`` reachable from the user's browser.

    The ``base_url`` is where the page bundle is served (used for
    ``<script src>`` and ``<link href>``); the ``ws_url`` is what the
    page dials for the JSON-RPC WebSocket.

    For local / VSCode-remote / standalone scripts, these point at
    ``localhost`` directly. For ``jupyter-server-proxy`` setups we use
    the proxy prefix discovered from ``JUPYTERHUB_SERVICE_PREFIX``.
    Google Colab requires the JS-side proxy helper, so we emit a marker
    URL the cell script rewrites at runtime.
    """
    env = detect_env()
    if env == "jupyter_proxy":
        prefix = _jupyter_proxy_base_url()
        if prefix:
            base = f"{prefix.rstrip('/')}/proxy/{port}/"
            ws = f"{prefix.rstrip('/')}/proxy/{port}/ws"
            return base, ws
    if env == "colab":
        return _colab_endpoints(port)
    return f"http://{host}:{port}/", f"ws://{host}:{port}/ws"
