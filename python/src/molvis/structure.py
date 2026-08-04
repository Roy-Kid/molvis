"""Structure coercion for the frame / molgraph API surface.

Convention
----------
Commands that take molecular data put the structure as the **first** argument
after ``self``::

    stage.draw_frame(frame, …)
    stage.draw(atomistic, …)       # Frame | Atomistic | molgraph
    stage.set_trajectory(frames, …)

:func:`frame_arg` and :func:`frames_arg` coerce that argument to a Frame-like.
Serialization is :mod:`molvis.wire`, which states each column's dtype from the
molrs field registry instead of leaving the browser to guess.
"""

from __future__ import annotations

import functools
import inspect
import logging
from collections.abc import Callable
from typing import Any, TypeVar

logger = logging.getLogger("molvis")

__all__ = [
    "coerce_to_frame",
    "frame_arg",
    "frame_payload",
    "frames_arg",
]

R = TypeVar("R")


def coerce_to_frame(
    obj: Any,
    *,
    atom_fields: list[str] | None = None,
) -> Any:
    """Normalize Frame | Atomistic | molgraph | mapping → Frame-like with ``to_dict``.

    Order of checks
    ---------------
    1. Mapping with ``blocks`` → passed through.
    2. Graph / Atomistic with ``to_frame`` only → ``to_frame(atom_fields=…)``.
    3. Object with both ``to_dict`` and ``to_frame`` → Frame if ``to_dict`` has
       ``blocks``, else ``to_frame``.
    4. Object with ``to_dict`` only → returned as-is.
    """
    if obj is None:
        raise TypeError("structure argument is required (got None)")

    if isinstance(obj, dict) and "blocks" in obj:
        return obj

    has_to_frame = callable(getattr(obj, "to_frame", None))
    has_to_dict = callable(getattr(obj, "to_dict", None))

    if has_to_frame and not has_to_dict:
        if atom_fields is not None:
            return obj.to_frame(atom_fields=atom_fields)
        return obj.to_frame()

    if has_to_frame and has_to_dict:
        # Both protocols present: prefer passing the object straight through
        # when to_dict() already yields a frame mapping. A failure here means
        # the object's own to_dict() is broken, which the caller needs to see
        # rather than have masked by the to_frame() fallback below.
        try:
            preview = obj.to_dict()
        except Exception as exc:
            logger.debug("to_dict() preview failed for %r: %s", type(obj), exc)
        else:
            if isinstance(preview, dict) and "blocks" in preview:
                return obj
        if atom_fields is not None:
            return obj.to_frame(atom_fields=atom_fields)
        return obj.to_frame()

    if has_to_dict:
        return obj

    raise TypeError(
        "expected a Frame (to_dict), Atomistic/molgraph (to_frame), or "
        f"frame mapping with 'blocks'; got {type(obj)!r}"
    )


def frame_payload(
    obj: Any,
    *,
    atom_fields: list[str] | None = None,
    inline: bool = False,
) -> tuple[dict[str, Any], list[Any]]:
    """Coerce a structure and serialize it → ``(wire frame, buffers)``."""
    from .wire import encode_frame

    return encode_frame(
        coerce_to_frame(obj, atom_fields=atom_fields),
        inline=inline,
    )


def _first_data_param(sig: inspect.Signature) -> str:
    params = [
        p
        for p in sig.parameters.values()
        if p.name != "self"
        and p.kind
        in (
            inspect.Parameter.POSITIONAL_ONLY,
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
        )
    ]
    if not params:
        raise TypeError("method must have a first data parameter after self")
    return params[0].name


def frame_arg(fn: Callable[..., R]) -> Callable[..., R]:
    """Decorator: first data arg is Frame | molgraph | Atomistic.

    Supports positional and keyword calls (``draw_frame(f)`` /
    ``draw_frame(frame=f)``).
    """

    sig = inspect.signature(fn)
    data_name = _first_data_param(sig)

    @functools.wraps(fn)
    def wrapper(self: Any, *args: Any, **kwargs: Any) -> R:
        bound = sig.bind(self, *args, **kwargs)
        bound.apply_defaults()
        atom_fields = bound.arguments.get("atom_fields")
        fields = atom_fields if isinstance(atom_fields, list) else None
        bound.arguments[data_name] = coerce_to_frame(
            bound.arguments[data_name], atom_fields=fields
        )
        return fn(*bound.args, **bound.kwargs)

    wrapper.__signature__ = sig  # type: ignore[attr-defined]
    return wrapper  # type: ignore[return-value]


def frames_arg(fn: Callable[..., R]) -> Callable[..., R]:
    """Decorator: first data arg is an iterable of structures → list[Frame]."""

    sig = inspect.signature(fn)
    data_name = _first_data_param(sig)

    @functools.wraps(fn)
    def wrapper(self: Any, *args: Any, **kwargs: Any) -> R:
        bound = sig.bind(self, *args, **kwargs)
        bound.apply_defaults()
        frames = bound.arguments[data_name]
        if frames is None:
            raise TypeError("frames argument is required (got None)")
        seq = list(frames)
        if not seq:
            raise ValueError("expected a non-empty sequence of frames/structures")
        bound.arguments[data_name] = [coerce_to_frame(item) for item in seq]
        return fn(*bound.args, **bound.kwargs)

    wrapper.__signature__ = sig  # type: ignore[attr-defined]
    return wrapper  # type: ignore[return-value]
