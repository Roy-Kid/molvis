from __future__ import annotations

import importlib
import sys
import types
from pathlib import Path


def install_widget_stubs() -> None:
    if "anywidget" not in sys.modules:
        anywidget = types.ModuleType("anywidget")

        class AnyWidget:
            def __init__(self, **kwargs):
                for key, value in kwargs.items():
                    setattr(self, key, value)

            def observe(self, *_args, **_kwargs) -> None:
                return None

            def send(self, *_args, **_kwargs) -> None:
                return None

        anywidget.AnyWidget = AnyWidget
        sys.modules["anywidget"] = anywidget

    if "traitlets" not in sys.modules:
        traitlets = types.ModuleType("traitlets")

        class Trait:
            def __init__(self, default=None):
                self.default = default

            def tag(self, **_kwargs):
                return self

        traitlets.Unicode = Trait
        traitlets.Int = Trait
        traitlets.Bool = Trait
        sys.modules["traitlets"] = traitlets

    if "molpy" not in sys.modules:
        molpy = types.ModuleType("molpy")

        class Frame:
            def __init__(self, blocks=None, metadata=None):
                self.blocks = blocks or {}
                self.metadata = metadata or {}

            def to_dict(self):
                return {"blocks": self.blocks, "metadata": self.metadata}

        class Box:
            def __init__(self, matrix=None, pbc=None, origin=None):
                self.matrix = matrix or []
                self.pbc = pbc or []
                self.origin = origin or []

            def to_dict(self):
                return {
                    "matrix": self.matrix,
                    "pbc": self.pbc,
                    "origin": self.origin,
                }

        molpy.Frame = Frame
        molpy.Box = Box
        sys.modules["molpy"] = molpy


def import_molvis_module():
    install_widget_stubs()
    src_root = Path(__file__).resolve().parents[1] / "src"
    if str(src_root) not in sys.path:
        sys.path.insert(0, str(src_root))
    sys.modules.pop("molvis", None)
    sys.modules.pop("molvis.scene", None)
    return importlib.import_module("molvis")


def test_named_scene_registry_round_trip():
    molvis = import_molvis_module()

    scene = molvis.Molvis(name="registry-test")

    assert molvis.Molvis.get_scene("registry-test") is scene
    assert "registry-test" in molvis.Molvis.list_scenes()

    scene.close()

    assert "registry-test" not in molvis.Molvis.list_scenes()


def test_scene_count_waits_for_rpc_response():
    molvis = import_molvis_module()
    scene = molvis.Molvis(name="rpc-test")
    captured: dict[str, object] = {}

    def fake_send_cmd(method, params, buffers=None, wait_for_response=False, timeout=10.0):
        captured["method"] = method
        captured["params"] = params
        captured["buffers"] = buffers
        captured["wait_for_response"] = wait_for_response
        captured["timeout"] = timeout
        return 7

    scene.send_cmd = fake_send_cmd

    assert molvis.Molvis.scene_count() == 7
    assert captured["method"] == "session.get_session_count"
    assert captured["wait_for_response"] is True


def test_scene_uses_explicit_session_key():
    molvis = import_molvis_module()

    scene = molvis.Molvis(name="shared-view", session="shared-session")

    assert scene.name == "shared-view"
    assert scene.session == "shared-session"
