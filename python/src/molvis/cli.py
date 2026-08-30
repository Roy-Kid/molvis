"""``molvis`` command-line entry point.

Open a molecular structure file straight in the browser::

    molvis open structure.data            # LAMMPS data (atom_style 'full')
    molvis open protein.pdb --style spacefill
    molvis open run.lammpstrj             # trajectory → playable in the viewer
    molvis open growth.mrec               # molpy mrec trajectory store
    molvis open growth.mrec --every 10    # keep every 10th frame
    molvis open growth.mrec.zip           # packed store (CLI only)

``open`` reads the file with :mod:`molpy`, pushes it to a fresh
:class:`~molvis.Molvis` viewer (which starts a local server and opens the
default browser), then blocks until the page is closed or ``Ctrl+C``.

A ``.mrec`` store is a directory, not a file, and may be ragged — frames are
free to differ in atom count (a growing system stays a single trajectory).
``*.mrec.zip`` is a packed archive of the same store (CLI only; GUI / stage
open directories). Large stores are strided down automatically (``--every 0``,
the default, targets ≲600 frames).
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import TYPE_CHECKING, Callable, Sequence

import molpy as mp

import molvis as mv
from molvis.commands.drawing import STYLE as _STYLES

if TYPE_CHECKING:
    from molpy import Frame

__all__ = ["main"]

# Single-frame readers keyed by lowercased file extension.
_READERS: dict[str, Callable[[Path], "Frame"]] = {
    ".pdb": mp.io.read_pdb,
    ".ent": mp.io.read_pdb,
    ".xyz": mp.io.read_xyz,
    ".extxyz": mp.io.read_xyz,
    ".gro": mp.io.read_gro,
    ".mol2": mp.io.read_mol2,
    ".xsf": mp.io.read_xsf,
}

# LAMMPS data carries no atom_style on disk, so it is dispatched separately
# with the caller-supplied ``--atom-style``.
_LAMMPS_DATA_EXT = frozenset({".data", ".lmp", ".lammps", ".lammpsdata"})

# Trajectory formats → a molrs lazy reader exposing ``read_all()``.
_TRAJECTORY_READERS: dict[str, Callable[[Path], object]] = {
    ".lammpstrj": mp.io.read_lammps_trajectory,
    ".dump": mp.io.read_lammps_trajectory,
    ".xyz": mp.io.read_xyz_trajectory,
    ".extxyz": mp.io.read_xyz_trajectory,
}

# mrec trajectory stores are directories (``growth.mrec/``) or a packed
# ``*.mrec.zip`` archive (CLI only). Dispatched separately from the file
# readers above.
_MREC_DIR_SUFFIX = ".mrec"
_MREC_ZIP_SUFFIX = ".mrec.zip"
_MREC_SUFFIXES = (_MREC_DIR_SUFFIX, _MREC_ZIP_SUFFIX)

# ``--every 0`` (auto) strides a large store down to at most this many frames.
_ZARR_TARGET_FRAMES = 600

# Stores larger than this are streamed frame-by-frame (``append_frame``)
# instead of one ``set_trajectory`` message carrying every buffer at once.
_ZARR_SET_TRAJECTORY_MAX = 64


def _supported_extensions() -> str:
    """Space-joined list of every extension ``open`` understands."""
    exts = {*_READERS, *_LAMMPS_DATA_EXT, *_TRAJECTORY_READERS, *_MREC_SUFFIXES}
    return " ".join(sorted(exts))


def _mrec_suffix(path: Path) -> str | None:
    """Return ``.mrec`` / ``.mrec.zip`` when ``path`` is an mrec store."""
    name = path.name.lower()
    if name.endswith(_MREC_ZIP_SUFFIX):
        return _MREC_ZIP_SUFFIX
    if name.endswith(_MREC_DIR_SUFFIX):
        return _MREC_DIR_SUFFIX
    return None


def _load_single_frame(path: Path, atom_style: str) -> "Frame":
    """Read ``path`` as a single static frame."""
    ext = path.suffix.lower()
    if ext in _LAMMPS_DATA_EXT:
        return mp.io.read_lammps_data(path, atom_style)
    reader = _READERS.get(ext)
    if reader is None:
        raise ValueError(
            f"unsupported file type '{ext or path.name}'. "
            f"supported: {_supported_extensions()}"
        )
    return reader(path)


def _load_trajectory(path: Path) -> list["Frame"]:
    """Read ``path`` as a multi-frame trajectory."""
    ext = path.suffix.lower()
    reader_factory = _TRAJECTORY_READERS.get(ext)
    if reader_factory is None:
        supported = " ".join(sorted([*_TRAJECTORY_READERS, *_MREC_SUFFIXES]))
        raise ValueError(
            f"'{ext or path.name}' is not a recognised trajectory format. "
            f"trajectory formats: {supported}"
        )
    reader = reader_factory(path)
    return list(reader.read_all())


def _load_zarr_trajectory(
    path: Path, every: int = 0
) -> tuple[list["Frame"], list[int] | None]:
    """Read a molpy ``*.mrec`` trajectory store → ``(frames, steps)``.

    Frames may be ragged (per-frame atom counts differ — e.g. a chain-growth
    trajectory where atoms exist only once placed). ``every=0`` auto-strides
    a large store down to ≤ ``_ZARR_TARGET_FRAMES`` frames; any positive value
    keeps every ``every``-th frame (the last frame is always kept).

    Frames come from :class:`molpy.io.mrec.TrajectoryReader` and are upgraded
    to :class:`molpy.Frame` for the wire serializer. The cursor does not
    expose the store's ``step`` axis, so frame labels are omitted.
    """
    from molpy.io.mrec import TrajectoryReader

    reader = TrajectoryReader(path)
    raw_frames: list["Frame"] = []
    index = 0
    while True:
        try:
            raw_frames.append(reader.read_frame(index))
        except IndexError:
            break
        index += 1
    n = len(raw_frames)
    if n == 0:
        raise ValueError(f"{path.name} holds no frames")
    if every <= 0:
        every = max(1, -(-n // _ZARR_TARGET_FRAMES))
    indices = list(range(0, n, every))
    if indices[-1] != n - 1:
        indices.append(n - 1)

    frames = [mp.Frame.from_dict(raw_frames[i]) for i in indices]
    return frames, None


def _cmd_open(args: argparse.Namespace) -> int:
    """Handle ``molvis open <file>``."""
    path: Path = args.file.expanduser()
    mrec_suffix = _mrec_suffix(path)
    is_mrec = mrec_suffix is not None
    if is_mrec:
        exists = path.is_file() if mrec_suffix == _MREC_ZIP_SUFFIX else path.is_dir()
        if not exists:
            print(f"molvis: no such mrec store: {path}")
            return 1
    elif not path.is_file():
        print(f"molvis: no such file: {path}")
        return 1

    is_trajectory = (
        is_mrec
        or args.trajectory
        or path.suffix.lower()
        in (
            ".lammpstrj",
            ".dump",
        )
    )
    steps: list[int] | None = None
    try:
        if is_mrec:
            payload, steps = _load_zarr_trajectory(path, args.every)
        elif is_trajectory:
            payload = _load_trajectory(path)
        else:
            payload = _load_single_frame(path, args.atom_style)
    except ValueError as exc:
        print(f"molvis: {exc}")
        return 1
    except Exception as exc:  # noqa: BLE001 — surface any reader failure cleanly
        print(f"molvis: failed to read {path.name}: {exc}")
        return 1

    transport = mv.WebSocketTransport(open_browser=not args.no_browser)
    scene = mv.Molvis(name=args.name, transport=transport)

    # ``draw_frame`` / ``set_trajectory`` block until a page connects and
    # acks. With ``--no-browser`` nobody is auto-opened, so print the URL
    # first — otherwise the hint would never reach the user in time.
    if args.no_browser:
        try:
            scene.connection_url  # noqa: B018 — forces the server to start
            url = transport.page_endpoints(session=scene.name).standalone_url
            print(f"molvis: open this URL in a browser → {url}")
        except Exception:  # noqa: BLE001 — URL hint is best-effort
            print("molvis: server started; open the printed port in a browser")

    if is_trajectory:
        if len(payload) > _ZARR_SET_TRAJECTORY_MAX:
            # One set_trajectory message would carry every frame's buffers at
            # once; a long trajectory goes over as one blocking head frame
            # (which waits for the page to connect) plus a stream of appends.
            scene.set_trajectory(payload[:1])
            for frame in payload[1:]:
                scene.append_frame(frame, follow=False)
        else:
            scene.set_trajectory(payload)
        if steps is not None:
            scene.set_frame_labels({"step": steps})
        print(f"molvis: loaded {len(payload)} frame(s) from {path.name}")
    else:
        scene.draw_frame(payload)
        print(f"molvis: opened {path.name}")
    scene.set_style(style=args.style)

    print("molvis: viewer is live — press Ctrl+C to close")
    scene.wait()
    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="molvis",
        description="Interactive molecular visualization from the terminal.",
    )
    sub = parser.add_subparsers(dest="command")

    open_p = sub.add_parser(
        "open",
        help="open a structure or trajectory file in the browser",
        description=(
            "Read a molecular file and display it in a MolVis browser tab. "
            f"Supported: {_supported_extensions()}"
        ),
    )
    open_p.add_argument("file", type=Path, help="path to the file to open")
    open_p.add_argument(
        "--style",
        choices=_STYLES,
        default="ball-and-stick",
        help="rendering style (default: ball-and-stick)",
    )
    open_p.add_argument(
        "--atom-style",
        default="full",
        help="LAMMPS atom_style for .data files (default: full)",
    )
    open_p.add_argument(
        "-t",
        "--trajectory",
        action="store_true",
        help="read the file as a trajectory (all frames)",
    )
    open_p.add_argument(
        "--every",
        type=int,
        default=0,
        help=(
            "for .mrec stores: keep every Nth frame; 0 (default) auto-strides "
            f"large stores down to ≤{_ZARR_TARGET_FRAMES} frames"
        ),
    )
    open_p.add_argument(
        "--name",
        default=None,
        help="session name for the viewer (default: 'default')",
    )
    open_p.add_argument(
        "--no-browser",
        action="store_true",
        help="start the server but do not open a browser; print the URL",
    )
    open_p.set_defaults(func=_cmd_open)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Console-script entry point. Returns a process exit code."""
    parser = _build_parser()
    args = parser.parse_args(argv)
    func = getattr(args, "func", None)
    if func is None:
        parser.print_help()
        return 1
    return func(args)


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
