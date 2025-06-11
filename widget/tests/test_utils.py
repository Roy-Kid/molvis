import os
from io import BytesIO

import h5py
import numpy as np
import molpy

from molvis.utils import frame_to_dict, to_h5py
from molvis.widget import Molvis


def _make_dummy_widget():
    os.makedirs("/workspaces/molvis/widget/dist", exist_ok=True)
    with open("/workspaces/molvis/widget/dist/index.js", "w") as fp:
        fp.write("console.log('dummy')")

    class Dummy(Molvis):
        def __init__(self):
            super().__init__()
            self.last = None

        def send_cmd(self, method, params, buffers):
            self.last = (method, params, buffers)
            return self

    return Dummy()


def test_frame_to_dict():
    f = molpy.core.Frame()
    f["atoms"] = {"id": [0], "x": [0.0], "y": [0.0], "z": [0.0]}
    d = frame_to_dict(f)
    assert "atoms" in d
    assert d["atoms"]["id"] == [0]


def test_to_h5py_roundtrip():
    data = {"x": [1, 2, 3], "y": [4, 5, 6]}
    buf = to_h5py(data)
    with h5py.File(BytesIO(buf), "r") as h5:
        assert np.allclose(h5["x"][:], data["x"])
        assert np.allclose(h5["y"][:], data["y"])


def test_draw_frame_sends_buffers():
    f = molpy.core.Frame()
    f["atoms"] = {"id": [0], "x": [0.0], "y": [0.0], "z": [0.0], "name": ["H"]}
    f["bonds"] = {"i": [0], "j": [0]}

    w = _make_dummy_widget()
    w.draw_frame(f)
    assert w.last is not None
    method, params, buffers = w.last
    assert method == "draw_frame"
    assert isinstance(buffers[0], (bytes, bytearray))
    assert len(buffers) == 2
