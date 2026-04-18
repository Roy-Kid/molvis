"""Smoke tests for the Molvis scene handle: registry, send_cmd routing,
display bundle."""

from __future__ import annotations

import pytest

from molvis import Molvis
from molvis.events import EventBus
from molvis.transport import PageEndpoints


class FakeTransport:
    def __init__(self) -> None:
        self.event_bus: EventBus | None = None
        self.started = False
        self.stopped = False
        self.sent: list[tuple[str, dict, dict]] = []

    def attach_event_bus(self, bus: EventBus) -> None:
        self.event_bus = bus

    def start(self) -> int:
        self.started = True
        return 0

    def stop(self) -> None:
        self.stopped = True

    def send_request(
        self,
        method: str,
        params: dict,
        *,
        buffers=None,
        wait_for_response: bool = False,
        timeout: float = 10.0,
    ):
        self.sent.append(
            (method, params, {"wait": wait_for_response, "timeout": timeout})
        )
        return {"jsonrpc": "2.0", "id": 1, "result": {"ok": True}}

    def page_endpoints(self, *, session: str) -> PageEndpoints:
        base = "http://localhost:1234/"
        return PageEndpoints(
            base_url=base,
            ws_url="ws://localhost:1234/ws",
            session=session,
            token="t0k",
            scripts=(f"{base}static/js/lib.abc.js", f"{base}static/js/index.abc.js"),
            css=(f"{base}static/css/index.abc.css",),
            standalone_url=f"{base}?ws_url=ws&token=t0k&session={session}",
        )


@pytest.fixture(autouse=True)
def _reset_registry() -> None:
    Molvis._scene_registry.clear()
    yield
    Molvis._scene_registry.clear()


def test_named_scene_registry_round_trip() -> None:
    scene = Molvis(name="registry-test", transport=FakeTransport())
    assert Molvis.get_scene("registry-test") is scene
    assert "registry-test" in Molvis.list_scenes()
    scene.close()
    assert "registry-test" not in Molvis.list_scenes()


def test_duplicate_name_returns_same_instance() -> None:
    first = Molvis(name="dup", transport=FakeTransport())
    second = Molvis(name="dup", transport=FakeTransport())
    assert first is second


def test_send_cmd_routes_through_transport() -> None:
    fake = FakeTransport()
    scene = Molvis(name="route-test", transport=fake)

    result = scene.send_cmd(
        "scene.clear", {}, wait_for_response=True, timeout=3.5
    )

    assert fake.started is True
    assert result == {"ok": True}
    method, params, meta = fake.sent[0]
    assert method == "scene.clear"
    assert params == {}
    assert meta["wait"] is True
    assert meta["timeout"] == 3.5


def test_fire_and_forget_returns_self_for_chaining() -> None:
    scene = Molvis(name="fnf", transport=FakeTransport())
    returned = scene.send_cmd("view.set_mode", {"mode": "view"})
    assert returned is scene


def test_repr_mimebundle_emits_inline_mount() -> None:
    scene = Molvis(name="cell", transport=FakeTransport())
    bundle = scene._repr_mimebundle_()

    assert bundle["text/plain"].startswith("Molvis(name='cell',")

    html_body = bundle["text/html"]
    assert "<iframe" not in html_body
    assert 'class="molvis-cell"' in html_body
    assert 'width:1200px' in html_body
    assert 'height:800px' in html_body
    # Loader script ships the assets and the mount opts inline:
    assert "MolvisApp.mount" in html_body
    assert "useShadowDOM" in html_body
    assert "lib.abc.js" in html_body
    assert "index.abc.css" in html_body
    assert '"session": "cell"' in html_body
    assert '"wsUrl": "ws://localhost:1234/ws"' in html_body


def test_repr_mimebundle_respects_include_exclude() -> None:
    scene = Molvis(name="filtered", transport=FakeTransport())
    only_text = scene._repr_mimebundle_(include={"text/plain"})
    assert set(only_text.keys()) == {"text/plain"}

    drop_html = scene._repr_mimebundle_(exclude={"text/html"})
    assert "text/html" not in drop_html
    assert "text/plain" in drop_html


def test_close_stops_transport_and_drops_registry() -> None:
    fake = FakeTransport()
    scene = Molvis(name="close-test", transport=fake)
    scene.close()
    assert fake.stopped is True
    assert "close-test" not in Molvis.list_scenes()
