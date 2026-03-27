from __future__ import annotations

from test_scene_smoke import import_molvis_module


def test_send_cmd_raises_python_exception_for_frontend_rpc_error():
    molvis = import_molvis_module()
    scene = molvis.Molvis(name="error-test")

    def fake_send_request(*_args, **_kwargs):
        return {
            "jsonrpc": "2.0",
            "id": 3,
            "error": {
                "code": -32603,
                "message": "frontend exploded",
                "data": {"detail": "bad state"},
            },
        }

    scene._transport.send_request = fake_send_request

    try:
        scene.send_cmd("scene.draw_frame", {}, wait_for_response=True)
    except molvis.MolvisRpcError as exc:
        assert exc.method == "scene.draw_frame"
        assert exc.code == -32603
        assert exc.data == {"detail": "bad state"}
    else:  # pragma: no cover - explicit failure branch
        raise AssertionError("MolvisRpcError was not raised")
