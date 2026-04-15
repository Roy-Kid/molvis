"""Test palette RPC handlers directly."""
from __future__ import annotations

import json
from pathlib import Path

from molvis import Molvis


def test_palette_list_rpc_mock():
    """Test palette.list RPC with mocked send_cmd."""
    captured: dict[str, object] = {}

    def mock_send_cmd(method, params, buffers=None, wait_for_response=False, timeout=10.0):
        captured["method"] = method
        captured["params"] = params
        captured["wait_for_response"] = wait_for_response
        captured["timeout"] = timeout
        # For palette.list, simulate a response with 3 palettes
        if method == "palette.list":
            return [
                {"name": "cpk", "kind": "element", "size": 118},
                {"name": "glasbey-vivid", "kind": "categorical", "size": 256},
                {"name": "ovito", "kind": "element", "size": 118},
            ]
        return None

    molvis = Molvis(name="test")
    molvis.send_cmd = mock_send_cmd

    result = molvis.list_palettes(timeout=5.0)
    assert len(result) == 3
    assert result[0].name == "cpk"
    assert result[0].kind == "element"
    assert result[0].size == 118
    assert captured["method"] == "palette.list"
    assert captured["wait_for_response"] is True


def test_palette_get_rpc_mock():
    """Test palette.get RPC with mocked send_cmd."""
    captured: dict[str, object] = {}

    def mock_send_cmd(method, params, buffers=None, wait_for_response=False, timeout=10.0):
        captured["method"] = method
        captured["params"] = params
        captured["wait_for_response"] = wait_for_response
        captured["timeout"] = timeout
        # For palette.get, simulate a response with cpk palette
        if method == "palette.get" and params.get("name") == "cpk":
            return {
                "name": "cpk",
                "kind": "element",
                "size": 2,
                "entries": [
                    {"label": "H", "color": "#FFFFFF"},
                    {"label": "He", "color": "#D9FFFF"},
                ],
            }
        return None

    molvis = Molvis(name="test")
    molvis.send_cmd = mock_send_cmd

    result = molvis.get_palette("cpk", timeout=5.0)
    assert result.name == "cpk"
    assert result.kind == "element"
    assert result.size == 2
    assert len(result.entries) == 2
    assert result.entries[0].label == "H"
    assert result.entries[0].color == "#FFFFFF"
    assert captured["method"] == "palette.get"
    assert captured["params"] == {"name": "cpk"}
    assert captured["wait_for_response"] is True


def test_palette_preview_rpc():
    """Test palette_preview which calls get_palette via RPC."""
    captured: dict[str, object] = {}

    def mock_send_cmd(method, params, buffers=None, wait_for_response=False, timeout=10.0):
        captured["method"] = method
        if method == "palette.get" and params.get("name") == "test":
            return {
                "name": "test",
                "kind": "categorical",
                "size": 3,
                "entries": [
                    {"label": "1", "color": "#FF0000"},
                    {"label": "2", "color": "#00FF00"},
                    {"label": "3", "color": "#0000FF"},
                ],
            }
        return None

    molvis = Molvis(name="test")
    molvis.send_cmd = mock_send_cmd

    png_bytes = molvis.palette_preview("test", timeout=5.0)
    assert png_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    assert captured["method"] == "palette.get"
