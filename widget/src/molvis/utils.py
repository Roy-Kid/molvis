from __future__ import annotations

import io
from typing import Any, Mapping

import h5py
import numpy as np
import molpy as mp


def frame_to_dict(frame: mp.Frame) -> dict[str, Any]:
    """Convert a :class:`molpy.Frame` into a plain dictionary.

    The upstream ``molpy`` package currently lacks a ``to_dict`` method for
    ``Frame`` objects.  This helper mirrors the expected behaviour by extracting
    all datasets and scalars from the frame into standard Python types.
    """
    if hasattr(frame, "to_dict"):
        return frame.to_dict()  # type: ignore[attr-defined]

    data: dict[str, Any] = {}
    for key in getattr(frame, "_tree").keys():  # type: ignore[attr-defined]
        ds = frame[key]
        data[key] = {name: ds[name].values.tolist() for name in ds.data_vars}
    if getattr(frame, "box", None) is not None:
        data["box"] = frame.box.to_dict()
    data.update(getattr(frame, "_scalars", {}))
    return data


def to_h5py(data: Mapping[str, Any]) -> bytes:
    """Serialise a mapping of arrays to an in-memory HDF5 file."""
    buffer = io.BytesIO()
    with h5py.File(buffer, "w") as h5file:
        for key, value in data.items():
            arr = np.asarray(value)
            if arr.dtype.kind in {"U", "O"}:
                dtype = h5py.string_dtype(encoding="utf-8")
                h5file.create_dataset(key, data=arr.astype("S"), dtype=dtype)
            else:
                h5file.create_dataset(key, data=arr)
    buffer.seek(0)
    return buffer.getvalue()
