"""Pipe a stream of PNG frames into ffmpeg to produce a video file."""

from __future__ import annotations

import shutil
import subprocess
from collections.abc import Iterable
from pathlib import Path

__all__ = ["FfmpegNotFoundError", "write_video"]


class FfmpegNotFoundError(RuntimeError):
    """Raised when ``ffmpeg`` is not on PATH."""


def write_video(
    frames: Iterable[bytes],
    path: str | Path,
    *,
    fps: int = 30,
    codec: str = "libx264",
    crf: int = 18,
    pix_fmt: str = "yuv420p",
    extra_args: list[str] | None = None,
) -> Path:
    """Encode ``frames`` (PNG bytes) into a video at ``path`` via ffmpeg.

    Defaults produce a browser-playable mp4 (``yuv420p`` + ``+faststart``).
    The function streams frames into ffmpeg's stdin, so memory usage stays
    bounded regardless of trajectory length.

    Args:
        frames: Iterable of PNG byte payloads (e.g. ``viewer.snapshot()``).
        path: Output file path; parent directory must exist.
        fps: Output frame rate.
        codec: ffmpeg ``-c:v`` codec name.
        crf: Constant Rate Factor (lower = higher quality, 18 is visually
            lossless for libx264).
        pix_fmt: Pixel format. ``yuv420p`` is required for QuickTime /
            browser playback.
        extra_args: Additional ffmpeg arguments inserted before the output
            path (e.g. ``["-vf", "scale=1920:1080"]``).

    Returns:
        Resolved absolute path of the written file.

    Raises:
        FfmpegNotFoundError: If ``ffmpeg`` is not available on PATH.
        RuntimeError: If ffmpeg exits with a non-zero status.
    """
    if shutil.which("ffmpeg") is None:
        raise FfmpegNotFoundError(
            "ffmpeg not found on PATH. Install it (brew install ffmpeg, "
            "apt-get install ffmpeg, choco install ffmpeg) before calling "
            "write_video()."
        )
    out = Path(path).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "-r",
        str(fps),
        "-i",
        "-",
        "-c:v",
        codec,
        "-crf",
        str(crf),
        "-pix_fmt",
        pix_fmt,
        "-movflags",
        "+faststart",
        *(extra_args or []),
        str(out),
    ]

    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert proc.stdin is not None and proc.stderr is not None

    try:
        for png in frames:
            proc.stdin.write(png)
        proc.stdin.close()
        rc = proc.wait()
        if rc != 0:
            stderr = proc.stderr.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"ffmpeg exited with status {rc}\n{stderr.strip()}"
            )
    finally:
        if not proc.stdin.closed:
            proc.stdin.close()
        proc.stderr.close()

    return out
