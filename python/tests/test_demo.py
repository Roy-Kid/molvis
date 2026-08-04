"""Unit tests for molvis.demo step runner and %%mv.demo magic stripping."""

from __future__ import annotations

import asyncio
import importlib.util
import sys
from pathlib import Path


def _load_demo():
    """Load demo.py without importing molvis/__init__ (avoids molpy/molrs pin)."""
    path = Path(__file__).resolve().parents[1] / "src" / "molvis" / "demo.py"
    # Register a lightweight parent package so relative imports aren't needed.
    if "molvis" not in sys.modules:
        pkg = type(sys)("molvis")
        pkg.__path__ = [str(path.parent)]  # type: ignore[attr-defined]
        pkg.__package__ = "molvis"
        sys.modules["molvis"] = pkg
    name = "molvis.demo"
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


demo_mod = _load_demo()
run_demo = demo_mod.run_demo
strip_demo_magic = demo_mod.strip_demo_magic


def test_strip_demo_magic_absent():
    body, delay = strip_demo_magic("print(1)\n")
    assert delay is None
    assert body == "print(1)\n"


def test_strip_demo_magic_default_delay():
    body, delay = strip_demo_magic("%%mv.demo\nx = 1\n")
    assert delay == 0.2
    assert body == "x = 1\n"


def test_strip_demo_magic_delay_kw():
    body, delay = strip_demo_magic("%%mv.demo delay=0.5\nprint(1)\n")
    assert delay == 0.5
    assert "print(1)" in body


def test_strip_demo_magic_rejects_unclear_option():
    import pytest

    with pytest.raises(ValueError, match="delay"):
        strip_demo_magic("%%mv.demo rate=3\ny = 2\n")


def test_run_demo_executes_statements_in_order(monkeypatch):
    seen: list[int] = []

    async def _instant(_dt):
        return None

    monkeypatch.setattr(asyncio, "sleep", _instant)

    ns: dict = {"seen": seen}
    asyncio.run(
        run_demo(
            "seen.append(1)\nseen.append(2)\nseen.append(3)\n",
            ns,
            delay=0.1,
        )
    )
    assert seen == [1, 2, 3]


def test_run_demo_awaits_coroutines(monkeypatch):
    order: list[str] = []

    async def step():
        order.append("step")

    async def _instant(_dt):
        order.append("sleep")
        return None

    monkeypatch.setattr(asyncio, "sleep", _instant)

    ns = {"step": step, "order": order}
    asyncio.run(run_demo("await step()\norder.append('done')\n", ns, delay=0.01))
    assert order[0] == "step"
    assert order[-1] == "done"


def test_run_demo_paces_each_loop_iteration(monkeypatch):
    sleeps: list[float] = []

    async def _record(dt):
        sleeps.append(dt)

    monkeypatch.setattr(asyncio, "sleep", _record)
    ns = {"seen": []}
    asyncio.run(run_demo("for value in range(3):\n    seen.append(value)\n", ns, delay=0.25))

    assert ns["seen"] == [0, 1, 2]
    assert sleeps == [0.25, 0.25, 0.25]
