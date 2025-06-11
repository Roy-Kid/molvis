import pathlib
import anywidget
import traitlets
import logging
import json
import molpy as mp
from .types import JsonRPCRequest, JsonRPCResponse
from .utils import frame_to_dict, to_h5py
import random
from dataclasses import asdict

logger = logging.getLogger("molvis")

__version__ = "0.1.0"

bundled_assets_dir = pathlib.Path("/workspaces/molvis/widget/dist")
ESM_path = bundled_assets_dir / "index.js"
assert ESM_path.exists(), f"{ESM_path} not found"
ESM = ESM_path.read_text()


class Molvis(anywidget.AnyWidget):
    """A widget for molecular visualization using molpy and anywidget."""

    _esm = ESM
    width = traitlets.Int(800).tag(sync=True)
    height = traitlets.Int(600).tag(sync=True)
    session_id = traitlets.Int(random.randint(0, 99999)).tag(sync=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def send_cmd(self, method: str, params: dict, buffers: list) -> "Molvis":
        """Send a command to the frontend."""
        jsonrpc = JsonRPCRequest(
            jsonrpc="2.0",
            method=method,
            params=params,
            id=self.session_id,  # NOTE: session_id?
        )
        self.send(json.dumps(asdict(jsonrpc)), buffers=buffers)
        return self

    def recv_cmd(self, msg: dict) -> dict:
        """Handle received commands from the frontend."""
        logger.info(f"recv_cmd: {msg}")
        return msg

    def draw_atom(self, name, x, y, z, element=None):
        self.send_cmd(
            "draw_atom",
            {
                "name": name,
                "x": x,
                "y": y,
                "z": z,
                "element": element,
            },
            [],
        )
        return self

    def draw_frame(
        self, frame: mp.Frame, atom_fields: list[str] = ["name", "element"]
    ) -> "Molvis":
        """Draw a molecular frame with optional properties and labels."""
        data = frame_to_dict(frame)

        atom_fields = ["x", "y", "z", *atom_fields]
        atoms_data = {k: data["atoms"][k] for k in atom_fields if k in data["atoms"]}
        atoms_buffer = to_h5py(atoms_data)
        buffers = [atoms_buffer]

        bonds_data = data.get("bonds")
        if bonds_data:
            bonds_buffer = to_h5py(bonds_data)
            buffers.append(bonds_buffer)

        self.send_cmd(
            "draw_frame",
            {
                "atoms": "__buffer.0",
                "bonds": "__buffer.1",
                "options": {"atoms": {}, "bonds": {}},
            },
            buffers,
        )

        return self
