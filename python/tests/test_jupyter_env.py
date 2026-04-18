"""Unit tests for transport._jupyter_env URL detection."""

from __future__ import annotations

import importlib

import pytest


@pytest.fixture(autouse=True)
def _clear_cache():
    from molvis.transport import _jupyter_env

    _jupyter_env.detect_env.cache_clear()
    yield
    _jupyter_env.detect_env.cache_clear()


def test_local_endpoints_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """Outside any kernel we expect plain localhost URLs."""
    from molvis.transport._jupyter_env import resolve_endpoints

    monkeypatch.delenv("JUPYTERHUB_SERVICE_PREFIX", raising=False)
    monkeypatch.delenv("JUPYTER_SERVER_URL", raising=False)
    monkeypatch.delenv("VSCODE_PID", raising=False)
    monkeypatch.delenv("VSCODE_IPC_HOOK_CLI", raising=False)

    base, ws = resolve_endpoints("localhost", 5000)
    assert base == "http://localhost:5000/"
    assert ws == "ws://localhost:5000/ws"


def test_jupyter_proxy_prefix_is_honoured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When jupyter-server-proxy is available the URL is prefixed."""
    from molvis.transport import _jupyter_env

    monkeypatch.setattr(_jupyter_env, "in_jupyter_kernel", lambda: True)
    monkeypatch.setattr(_jupyter_env, "_has_google_colab", lambda: False)
    monkeypatch.setattr(
        _jupyter_env, "_has_jupyter_server_proxy", lambda: True
    )
    monkeypatch.setenv("JUPYTERHUB_SERVICE_PREFIX", "/user/me/")

    base, ws = _jupyter_env.resolve_endpoints("localhost", 4242)
    assert base == "/user/me/proxy/4242/"
    assert ws == "/user/me/proxy/4242/ws"


def test_vscode_remote_uses_local_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """VSCode auto-forwards localhost ports — plain URL is fine."""
    from molvis.transport import _jupyter_env

    monkeypatch.setattr(_jupyter_env, "in_jupyter_kernel", lambda: True)
    monkeypatch.setattr(_jupyter_env, "_has_google_colab", lambda: False)
    monkeypatch.setattr(
        _jupyter_env, "_has_jupyter_server_proxy", lambda: False
    )
    monkeypatch.setenv("VSCODE_PID", "12345")

    assert _jupyter_env.detect_env() == "vscode"
    base, ws = _jupyter_env.resolve_endpoints("127.0.0.1", 7000)
    assert base == "http://127.0.0.1:7000/"
    assert ws == "ws://127.0.0.1:7000/ws"


def test_detect_env_is_cached() -> None:
    from molvis.transport._jupyter_env import detect_env

    first = detect_env()
    second = detect_env()
    assert first == second
