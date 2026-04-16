from __future__ import annotations

import importlib
import sys
from pathlib import Path

import numpy as np

from test_scene_smoke import install_widget_stubs


def import_transport_module():
    install_widget_stubs()
    src_root = Path(__file__).resolve().parents[1] / "src"
    if str(src_root) not in sys.path:
        sys.path.insert(0, str(src_root))
    sys.modules.pop("molvis.transport", None)
    return importlib.import_module("molvis.transport")


def test_binary_transport_round_trip_preserves_numeric_arrays():
    transport = import_transport_module()
    encoder = transport.BinaryPayloadEncoder()
    decoder = transport.BinaryPayloadDecoder()

    payload = {
        "atoms": {
            "x": np.array([0.0, 1.5, 3.0], dtype=np.float32),
            "labels": np.array(["C", "H", "O"]),
        }
    }

    encoded = encoder.encode(payload)
    decoded = decoder.decode(encoded, encoder.buffers)

    assert len(encoder.buffers) == 1
    assert encoded["atoms"]["x"]["__molvis_buffer__"] is True
    assert decoded["atoms"]["labels"] == ["C", "H", "O"]
    np.testing.assert_allclose(
        decoded["atoms"]["x"],
        np.array([0.0, 1.5, 3.0], dtype=np.float32),
    )
