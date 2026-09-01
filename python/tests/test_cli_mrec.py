"""``molvis open <store>.mrec`` — the mrec trajectory loader."""

from __future__ import annotations

import numpy as np
import pytest

import molpy as mp
from molpy.io.mrec import write_frame, write_trajectory
import molvis.cli as cli
from molvis.cli import _load_mrec_trajectory
from molvis.structure import frame_payload


def _ragged_store(tmp_path, counts=(3, 5, 4), steps=(0, 10, 25)):
    """Write a small ragged store: per-frame atom counts differ."""
    frames = []
    for n in counts:
        frame = mp.Frame(
            {
                "atoms": {
                    "x": np.arange(n, dtype=np.float64),
                    "y": np.zeros(n),
                    "z": np.zeros(n),
                    "element": ["C"] * n,
                }
            }
        )
        frame.box = mp.Box.cube(20.0)
        frames.append(frame)
    path = tmp_path / "growth.mrec"
    write_trajectory(path, mp.Trajectory(frames, step=np.array(steps, dtype=np.int64)))
    return path


def test_ragged_frames_round_trip(tmp_path) -> None:
    path = _ragged_store(tmp_path)
    frames, _ = _load_mrec_trajectory(path)
    assert [f["atoms"].nrows for f in frames] == [3, 5, 4]
    assert frames[0].box is not None
    assert frames[0].box.lengths[0] == pytest.approx(20.0)


def test_steps_ride_along(tmp_path) -> None:
    path = _ragged_store(tmp_path, steps=(0, 10, 25))
    _, steps = _load_mrec_trajectory(path)
    assert steps == [0, 10, 25]


def test_every_strides_but_keeps_last(tmp_path) -> None:
    path = _ragged_store(tmp_path, counts=(3, 5, 4, 6, 2), steps=(0, 1, 2, 3, 4))
    frames, steps = _load_mrec_trajectory(path, every=2)
    assert steps == [0, 2, 4]
    assert [f["atoms"].nrows for f in frames] == [3, 4, 2]


def test_auto_stride_caps_frame_count(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(cli, "_MREC_TARGET_FRAMES", 4)
    path = _ragged_store(tmp_path, counts=tuple([2] * 10), steps=tuple(range(10)))
    frames, steps = _load_mrec_trajectory(path)
    assert len(frames) <= 4 + 1  # stride hits the cap; the last frame is kept
    assert steps[-1] == 9


def test_snapshot_store_is_one_frame(tmp_path) -> None:
    frame = mp.Frame(
        {
            "atoms": {
                "x": np.array([1.0, 2.0]),
                "y": np.zeros(2),
                "z": np.zeros(2),
                "element": ["C", "O"],
            }
        }
    )
    frame.box = mp.Box.cube(12.0)
    path = tmp_path / "final.mrec"
    write_frame(path, frame)
    frames, steps = _load_mrec_trajectory(path)
    assert len(frames) == 1
    assert frames[0]["atoms"].nrows == 2
    assert steps is None


def test_loader_output_serializes_on_the_wire(tmp_path) -> None:
    path = _ragged_store(tmp_path)
    frames, _ = _load_mrec_trajectory(path)
    payload, buffers = frame_payload(frames[1])
    assert "atoms" in payload["blocks"]
    assert buffers  # coordinate columns travel as binary buffers


def test_supported_extensions_include_mrec_not_bare_zarr() -> None:
    exts = cli._supported_extensions().split()
    assert ".mrec" in exts
    # `.mrec.zip` is intentionally absent until molrs `open_packed` is bound.
    assert ".mrec.zip" not in exts
    assert ".zarr" not in exts
