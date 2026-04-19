"""
Programmatic control over a running MolVis viewer.

Provides camera manipulation, frame seeking, and snapshot capture for
scripting workflows: rotate the camera around a structure, walk through a
trajectory frame by frame, capture each as a PNG, then pipe the result into
ffmpeg via :mod:`molvis.video`.

The mixin shadows :class:`SnapshotCommandsMixin.snapshot` (legacy
``snapshot.take`` RPC) with a richer implementation that returns binary
PNG bytes via ``capture.snapshot`` — keep ``ControlMixin`` listed before
``SnapshotCommandsMixin`` in the MRO of any subclass.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .video import write_video as _write_video_t  # noqa: F401

__all__ = ["Camera", "CameraPose", "ControlMixin"]


@dataclass(frozen=True)
class CameraPose:
    """Snapshot of an :class:`ArcRotateCamera` pose.

    Coordinates follow MolVis's Z-up convention. ``alpha`` is the azimuth in
    the XY plane; ``beta`` is the polar angle measured from +Z.
    """

    alpha: float
    beta: float
    radius: float
    target: tuple[float, float, float]
    position: tuple[float, float, float]
    up: tuple[float, float, float]

    @classmethod
    def from_rpc(cls, payload: dict[str, Any]) -> "CameraPose":
        return cls(
            alpha=float(payload["alpha"]),
            beta=float(payload["beta"]),
            radius=float(payload["radius"]),
            target=tuple(float(v) for v in payload["target"]),
            position=tuple(float(v) for v in payload["position"]),
            up=tuple(float(v) for v in payload["up"]),
        )


class Camera:
    """Proxy that translates camera operations to RPC calls on a viewer."""

    def __init__(self, viewer: Any) -> None:
        self._viewer = viewer

    def get_pose(self) -> CameraPose:
        result = self._viewer.send_cmd(
            "camera.get_pose", {}, wait_for_response=True
        )
        return CameraPose.from_rpc(result)

    def set_pose(
        self,
        *,
        alpha: float | None = None,
        beta: float | None = None,
        radius: float | None = None,
        target: Sequence[float] | None = None,
    ) -> CameraPose:
        params: dict[str, Any] = {}
        if alpha is not None:
            params["alpha"] = float(alpha)
        if beta is not None:
            params["beta"] = float(beta)
        if radius is not None:
            params["radius"] = float(radius)
        if target is not None:
            params["target"] = [float(v) for v in target]
        result = self._viewer.send_cmd(
            "camera.set_pose", params, wait_for_response=True
        )
        return CameraPose.from_rpc(result["pose"])

    def look_at(
        self,
        position: Sequence[float],
        target: Sequence[float],
        up: Sequence[float] | None = None,
    ) -> CameraPose:
        params: dict[str, Any] = {
            "position": [float(v) for v in position],
            "target": [float(v) for v in target],
        }
        if up is not None:
            params["up"] = [float(v) for v in up]
        result = self._viewer.send_cmd(
            "camera.look_at", params, wait_for_response=True
        )
        return CameraPose.from_rpc(result["pose"])

    def fit_view(self) -> CameraPose:
        result = self._viewer.send_cmd(
            "camera.fit_view", {}, wait_for_response=True
        )
        return CameraPose.from_rpc(result["pose"])


def _png_bytes_from_response(response: Any) -> bytes:
    """Extract PNG bytes from a ``capture.snapshot`` response.

    The transport's ``BinaryPayloadDecoder`` resolves the ``png_ref``
    placeholder into a uint8 ndarray. We accept both the decoded ndarray
    and a raw bytes/bytearray fallback so the helper survives transport
    variations.
    """
    if isinstance(response, dict):
        ref = response.get("png_ref")
        if hasattr(ref, "tobytes"):
            return ref.tobytes()
        if isinstance(ref, (bytes, bytearray, memoryview)):
            return bytes(ref)
        # Some transports (legacy or fallback) may stuff base64 into a
        # 'data' field — handle gracefully.
        data = response.get("data")
        if isinstance(data, str):
            import base64
            payload = data.split(",", 1)[1] if "," in data else data
            return base64.b64decode(payload)
    if hasattr(response, "tobytes"):
        return response.tobytes()
    raise ValueError(
        f"Unexpected capture.snapshot response shape: {type(response).__name__}"
    )


class ControlMixin:
    """Camera, frame seeking, and snapshot ergonomics for any viewer that
    exposes :meth:`send_cmd` (Jupyter ``Molvis`` and ``StandaloneMolvis``).
    """

    @property
    def camera(self) -> Camera:
        proxy = getattr(self, "_camera_proxy", None)
        if proxy is None:
            proxy = Camera(self)
            self._camera_proxy = proxy  # type: ignore[attr-defined]
        return proxy

    def seek_frame(self, index: int) -> dict[str, int]:
        return self.send_cmd(
            "frame.seek", {"index": int(index)}, wait_for_response=True
        )

    def next_frame(self) -> dict[str, int]:
        return self.send_cmd("frame.next", {}, wait_for_response=True)

    def prev_frame(self) -> dict[str, int]:
        return self.send_cmd("frame.prev", {}, wait_for_response=True)

    def frame_info(self) -> dict[str, int]:
        return self.send_cmd("frame.info", {}, wait_for_response=True)

    @property
    def n_frames(self) -> int:
        return int(self.frame_info()["total"])

    def snapshot(
        self,
        *,
        width: int | None = None,
        height: int | None = None,
        transparent: bool = False,
        auto_crop: bool = False,
        crop_padding: int | None = None,
        quality: float | None = None,
        frame_index: int | None = None,
        timeout: float = 30.0,
    ) -> bytes:
        """Capture the current viewport as PNG bytes.

        ``frame_index`` performs seek + render + capture in one round-trip
        for use in animation hot loops. The default 30-second timeout
        accommodates large-resolution offscreen renders.
        """
        params: dict[str, Any] = {
            "transparent": bool(transparent),
            "autoCrop": bool(auto_crop),
        }
        if width is not None:
            params["width"] = int(width)
        if height is not None:
            params["height"] = int(height)
        if crop_padding is not None:
            params["cropPadding"] = int(crop_padding)
        if quality is not None:
            params["quality"] = float(quality)
        if frame_index is not None:
            params["frameIndex"] = int(frame_index)
        response = self.send_cmd(
            "capture.snapshot",
            params,
            wait_for_response=True,
            timeout=timeout,
        )
        return _png_bytes_from_response(response)

    def render_animation(
        self,
        out_path: str | Path,
        *,
        frame_indices: Sequence[int] | None = None,
        camera_path: Sequence[CameraPose | None] | None = None,
        fps: int = 30,
        width: int = 1920,
        height: int = 1080,
        **video_kwargs: Any,
    ) -> Path:
        """Drive a seek + pose + snapshot loop and pipe results to ffmpeg.

        ``frame_indices`` defaults to every frame in the current trajectory;
        ``camera_path`` may be ``None`` (no per-frame pose change) or a
        sequence of poses with the same length as ``frame_indices``.
        """
        from .video import write_video

        indices: Sequence[int]
        if frame_indices is None:
            indices = range(self.n_frames)
        else:
            indices = frame_indices
        indices = list(indices)

        poses: list[CameraPose | None]
        if camera_path is None:
            poses = [None] * len(indices)
        else:
            poses = list(camera_path)
        if len(indices) != len(poses):
            raise ValueError(
                "frame_indices and camera_path must have the same length"
            )

        def _stream() -> Iterable[bytes]:
            for idx, pose in zip(indices, poses):
                if pose is not None:
                    self.camera.set_pose(
                        alpha=pose.alpha,
                        beta=pose.beta,
                        radius=pose.radius,
                        target=pose.target,
                    )
                yield self.snapshot(
                    width=width, height=height, frame_index=int(idx)
                )

        return write_video(_stream(), out_path, fps=fps, **video_kwargs)
