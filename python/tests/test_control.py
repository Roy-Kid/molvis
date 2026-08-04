from __future__ import annotations

import importlib
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import numpy as np


def import_control_module():
    """Load control.py by path — avoid molvis/__init__ (pulls molpy/molrs)."""
    import importlib.util

    path = Path(__file__).resolve().parents[1] / "src" / "molvis" / "control.py"
    if "molvis" not in sys.modules:
        pkg = type(sys)("molvis")
        pkg.__path__ = [str(path.parent)]  # type: ignore[attr-defined]
        pkg.__package__ = "molvis"
        sys.modules["molvis"] = pkg
    name = "molvis.control"
    sys.modules.pop(name, None)
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


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
    out = cam.set_pose(alpha=1.5, target=(0.0, 0.0, 0.0))
    assert out is cam

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
    out = cam.look_at(position=(10, 0, 0), target=(0, 0, 0), up=(0, 0, 1))
    assert out is cam

    sent = viewer.calls[0]["params"]
    assert sent["position"] == [10.0, 0.0, 0.0]
    assert sent["target"] == [0.0, 0.0, 0.0]
    assert sent["up"] == [0.0, 0.0, 1.0]


def test_control_mixin_seek_frame_passes_index():
    control = import_control_module()
    viewer = FakeViewer(responses={"scene.seek_frame": {"current": 5, "total": 100}})

    class Host(control.ControlMixin, FakeViewer):
        pass

    host = Host(responses=viewer.responses)
    result = host.seek_frame(5)

    assert result is host
    assert host.calls[0]["method"] == "scene.seek_frame"
    assert host.calls[0]["params"] == {"index": 5}


def test_control_mixin_n_frames_reads_viewer_state():
    """`n_frames` comes from the state snapshot, not a `frame.info` RPC."""
    control = import_control_module()

    class Host(control.ControlMixin, FakeViewer):
        def refresh_state(self, *, timeout: float = 10.0):
            return SimpleNamespace(frame_index=3, total_frames=100)

    assert Host().n_frames == 100


def test_render_animation_orchestrates_seek_pose_snapshot(tmp_path: Path, monkeypatch):
    control = import_control_module()
    png_bytes = b"\x89PNG\r\n\x1a\nFRAME"

    class Host(control.ControlMixin, FakeViewer):
        def snapshot(self, timeout: float = 5.0) -> bytes:
            return png_bytes

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
            "scene.seek_frame": {"index": 0, "total": 3},
            "camera.set_pose": pose_response,
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
    # Seek is its own round-trip now; the capture itself is snapshot.take.
    assert methods.count("scene.seek_frame") == 3


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


def test_camera_track_interpolates_keypoints_and_look_at(monkeypatch):
    """track() is the one API: key points + look-at → look_at samples."""
    control = import_control_module()
    pose_response = {
        "pose": {
            "alpha": 0.0,
            "beta": 1.0,
            "radius": 10.0,
            "target": [0.0, 0.0, 0.0],
            "position": [10.0, 0.0, 0.0],
            "up": [0.0, 0.0, 1.0],
        },
    }
    viewer = FakeViewer(responses={"camera.look_at": pose_response})
    cam = control.Camera(viewer)

    sleeps: list[float] = []
    monkeypatch.setattr(control, "_sleep", lambda dt: sleeps.append(dt))

    final = cam.track(
        [(10, 0, 0), (0, 10, 0), (-10, 0, 0)],
        target=(0, 0, 0),
        duration=1.0,
        fps=4,
        rate=1.0,
    )
    assert final is cam
    look_calls = [c for c in viewer.calls if c["method"] == "camera.look_at"]
    assert len(look_calls) >= 4
    assert look_calls[0]["params"]["position"] == [10.0, 0.0, 0.0]
    assert look_calls[0]["params"]["target"] == [0.0, 0.0, 0.0]
    assert all(c["params"]["target"] == [0.0, 0.0, 0.0] for c in look_calls)
    # duration=1, fps=4 → n_frames = int(4.999…)+1 = 5; dt = 1/4 = 0.25
    assert len(sleeps) == len(look_calls) - 1
    assert all(abs(dt - 0.25) < 1e-9 for dt in sleeps)


def test_camera_track_rate_scales_wall_clock_not_sample_count(monkeypatch):
    """rate speeds up / slows down wall time; fps still sets path samples."""
    control = import_control_module()
    pose_response = {
        "pose": {
            "alpha": 0.0,
            "beta": 1.0,
            "radius": 10.0,
            "target": [0.0, 0.0, 0.0],
            "position": [10.0, 0.0, 0.0],
            "up": [0.0, 0.0, 1.0],
        },
    }
    viewer = FakeViewer(responses={"camera.look_at": pose_response})
    cam = control.Camera(viewer)
    sleeps: list[float] = []
    monkeypatch.setattr(control, "_sleep", lambda dt: sleeps.append(dt))

    cam.track(
        [(10, 0, 0), (0, 10, 0)],
        target=(0, 0, 0),
        duration=2.0,
        fps=10,
        rate=2.0,
    )
    # content samples: n_frames = int(2*10 + 0.999…)+1 = 21
    # wall dt = (2/2) / 20 = 0.05
    look_calls = [c for c in viewer.calls if c["method"] == "camera.look_at"]
    assert len(look_calls) == 21
    assert len(sleeps) == 20
    assert all(abs(dt - 0.05) < 1e-9 for dt in sleeps)


def test_camera_track_defaults_fps_to_60():
    """Signature default for fps is 60 (playback-rate parameter is rate)."""
    control = import_control_module()
    import inspect

    sig = inspect.signature(control.Camera.track)
    assert sig.parameters["fps"].default == 60.0
    assert sig.parameters["rate"].default == 1.0


def test_camera_set_pose_requires_at_least_one_field():
    control = import_control_module()
    cam = control.Camera(FakeViewer())
    import pytest

    with pytest.raises(TypeError, match="at least one"):
        cam.set_pose()
