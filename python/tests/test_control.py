from __future__ import annotations

import importlib
import sys
from pathlib import Path
from typing import Any

import numpy as np

from test_scene_smoke import install_widget_stubs


def import_control_module():
    install_widget_stubs()
    src_root = Path(__file__).resolve().parents[1] / "src"
    if str(src_root) not in sys.path:
        sys.path.insert(0, str(src_root))
    sys.modules.pop("molvis.control", None)
    return importlib.import_module("molvis.control")


class FakeViewer:
    """Captures send_cmd calls and returns scripted responses."""

    def __init__(self, responses: dict[str, Any] | None = None) -> None:
        self.calls: list[dict[str, Any]] = []
        self.responses = responses or {}

    def send_cmd(
        self,
        method: str,
        params: dict[str, Any],
        buffers: list[Any] | None = None,
        wait_for_response: bool = False,
        timeout: float = 10.0,
    ) -> Any:
        self.calls.append(
            {
                "method": method,
                "params": params,
                "wait_for_response": wait_for_response,
                "timeout": timeout,
            }
        )
        if method in self.responses:
            response = self.responses[method]
            if callable(response):
                return response(params)
            return response
        return None


def test_camera_get_pose_returns_dataclass():
    control = import_control_module()
    viewer = FakeViewer(
        responses={
            "camera.get_pose": {
                "alpha": 1.0,
                "beta": 0.5,
                "radius": 12.0,
                "target": [1.0, 2.0, 3.0],
                "position": [4.0, 5.0, 6.0],
                "up": [0.0, 0.0, 1.0],
            }
        }
    )

    cam = control.Camera(viewer)
    pose = cam.get_pose()

    assert isinstance(pose, control.CameraPose)
    assert pose.alpha == 1.0
    assert pose.target == (1.0, 2.0, 3.0)
    assert viewer.calls[0]["method"] == "camera.get_pose"
    assert viewer.calls[0]["wait_for_response"] is True


def test_camera_set_pose_omits_unset_fields():
    control = import_control_module()
    viewer = FakeViewer(
        responses={
            "camera.set_pose": {
                "success": True,
                "pose": {
                    "alpha": 1.5,
                    "beta": 0.5,
                    "radius": 10.0,
                    "target": [0.0, 0.0, 0.0],
                    "position": [10.0, 0.0, 0.0],
                    "up": [0.0, 0.0, 1.0],
                },
            }
        }
    )

    cam = control.Camera(viewer)
    cam.set_pose(alpha=1.5, target=(0.0, 0.0, 0.0))

    sent = viewer.calls[0]["params"]
    assert sent == {"alpha": 1.5, "target": [0.0, 0.0, 0.0]}
    assert "beta" not in sent
    assert "radius" not in sent


def test_camera_look_at_serializes_vectors():
    control = import_control_module()
    viewer = FakeViewer(
        responses={
            "camera.look_at": {
                "success": True,
                "pose": {
                    "alpha": 0.0,
                    "beta": 1.5,
                    "radius": 10.0,
                    "target": [0.0, 0.0, 0.0],
                    "position": [10.0, 0.0, 0.0],
                    "up": [0.0, 0.0, 1.0],
                },
            }
        }
    )

    cam = control.Camera(viewer)
    cam.look_at(position=(10, 0, 0), target=(0, 0, 0), up=(0, 0, 1))

    sent = viewer.calls[0]["params"]
    assert sent["position"] == [10.0, 0.0, 0.0]
    assert sent["target"] == [0.0, 0.0, 0.0]
    assert sent["up"] == [0.0, 0.0, 1.0]


def test_control_mixin_seek_frame_passes_index():
    control = import_control_module()
    viewer = FakeViewer(responses={"frame.seek": {"current": 5, "total": 100}})

    class Host(control.ControlMixin, FakeViewer):
        pass

    host = Host(responses=viewer.responses)
    result = host.seek_frame(5)

    assert result == {"current": 5, "total": 100}
    assert host.calls[0]["method"] == "frame.seek"
    assert host.calls[0]["params"] == {"index": 5}


def test_control_mixin_n_frames_uses_frame_info():
    control = import_control_module()

    class Host(control.ControlMixin, FakeViewer):
        pass

    host = Host(responses={"frame.info": {"current": 0, "total": 42}})

    assert host.n_frames == 42
    assert host.calls[0]["method"] == "frame.info"


def test_snapshot_decodes_ndarray_png_ref():
    control = import_control_module()
    png_bytes = b"\x89PNG\r\n\x1a\nFAKEDATA"
    arr = np.frombuffer(png_bytes, dtype=np.uint8)

    class Host(control.ControlMixin, FakeViewer):
        pass

    host = Host(
        responses={
            "capture.snapshot": {
                "format": "png",
                "width": 640,
                "height": 480,
                "png_ref": arr,
            }
        }
    )

    result = host.snapshot(width=640, height=480)
    assert result == png_bytes

    sent = host.calls[0]["params"]
    assert sent["width"] == 640
    assert sent["height"] == 480
    assert sent["transparent"] is False
    assert sent["autoCrop"] is False


def test_snapshot_decodes_raw_bytes_fallback():
    control = import_control_module()
    png_bytes = b"\x89PNG\r\n\x1a\nFAKE"

    class Host(control.ControlMixin, FakeViewer):
        pass

    host = Host(
        responses={
            "capture.snapshot": {
                "format": "png",
                "width": None,
                "height": None,
                "png_ref": png_bytes,
            }
        }
    )

    assert host.snapshot() == png_bytes


def test_snapshot_decodes_legacy_data_url():
    control = import_control_module()
    import base64

    png_bytes = b"\x89PNG\r\n\x1a\nLEGACY"
    data_url = "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")

    class Host(control.ControlMixin, FakeViewer):
        pass

    host = Host(responses={"capture.snapshot": {"data": data_url}})
    assert host.snapshot() == png_bytes


def test_render_animation_orchestrates_seek_pose_snapshot(tmp_path: Path, monkeypatch):
    control = import_control_module()
    png_bytes = b"\x89PNG\r\n\x1a\nFRAME"

    class Host(control.ControlMixin, FakeViewer):
        pass

    pose_response = {
        "success": True,
        "pose": {
            "alpha": 0.0,
            "beta": 1.0,
            "radius": 10.0,
            "target": [0.0, 0.0, 0.0],
            "position": [10.0, 0.0, 0.0],
            "up": [0.0, 0.0, 1.0],
        },
    }
    host = Host(
        responses={
            "frame.info": {"current": 0, "total": 3},
            "camera.set_pose": pose_response,
            "capture.snapshot": {"png_ref": png_bytes},
        }
    )

    captured: dict[str, Any] = {}

    def fake_write_video(frames, path, **kwargs):
        captured["frames"] = list(frames)
        captured["path"] = path
        captured["kwargs"] = kwargs
        return Path(path)

    import molvis.video as video_mod

    monkeypatch.setattr(video_mod, "write_video", fake_write_video)

    poses = [
        control.CameraPose(
            alpha=float(i),
            beta=1.0,
            radius=10.0,
            target=(0.0, 0.0, 0.0),
            position=(10.0, 0.0, 0.0),
            up=(0.0, 0.0, 1.0),
        )
        for i in range(3)
    ]

    out = host.render_animation(
        tmp_path / "out.mp4",
        frame_indices=[0, 1, 2],
        camera_path=poses,
        fps=24,
    )

    assert out == tmp_path / "out.mp4"
    assert len(captured["frames"]) == 3
    assert all(f == png_bytes for f in captured["frames"])
    assert captured["kwargs"]["fps"] == 24

    methods = [c["method"] for c in host.calls]
    assert methods.count("camera.set_pose") == 3
    assert methods.count("capture.snapshot") == 3


def test_render_animation_rejects_mismatched_lengths():
    control = import_control_module()

    class Host(control.ControlMixin, FakeViewer):
        pass

    host = Host(responses={"frame.info": {"current": 0, "total": 2}})

    import pytest

    with pytest.raises(ValueError, match="same length"):
        host.render_animation(
            "out.mp4", frame_indices=[0, 1, 2], camera_path=[None, None]
        )
