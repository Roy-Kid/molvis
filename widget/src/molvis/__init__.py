import pathlib
import anywidget
import traitlets
import logging
import json
import molpy as mp
import pyarrow as pa
from .types import JsonRPCRequest, JsonRPCResponse
logger = logging.getLogger("molvis")
print("molvis.__init__")
__version__ = "0.1.0"

# Asset configuration
_DEV = True
if _DEV:
    ESM = "http://localhost:3000/static/js/index.js"
    CSS = ""
else:
    bundled_assets_dir = pathlib.Path(__file__).parent.parent / "static"
    ESM_path = bundled_assets_dir / "molvis.js"
    assert ESM_path.exists(), f"{ESM_path} not found"
    ESM = ESM_path.read_text()
    CSS = (bundled_assets_dir / "style.css").read_text()

class Molvis(anywidget.AnyWidget):
    """A widget for molecular visualization using molpy and anywidget."""

    # Widget configuration
    _esm = ESM
    # _css = CSS
    width = traitlets.Int(800).tag(sync=True)
    height = traitlets.Int(600).tag(sync=True)
    session_id = traitlets.Int(0).tag(sync=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.session_id = id(self)

    def send_cmd(self, method: str, params: dict, buffers: list) -> 'Molvis':
        """Send a command to the frontend."""
        # jsonrpc = {
        #     "jsonrpc": "2.0",
        #     "method": method,
        #     "params": params,
        #     "id": self.session_id,
        # }
        jsonrpc = JsonRPCRequest(
            jsonrpc="2.0",
            method=method,
            params=params,
            id=self.session_id, # NOTE: session_id?
        )
        logger.info(f"send_cmd: {jsonrpc} with {len(buffers)} buffers")
        self.send(json.dumps(dict(jsonrpc)), buffers=buffers)
        return self
    
    def recv_cmd(self, msg: dict) -> dict:
        """Handle received commands from the frontend."""
        logger.info(f"recv_cmd: {msg}")
        return msg

    def draw_frame(self, 
                  frame: mp.Frame, 
                  atom_fields: list[str] = []
                ) -> 'Molvis':
        """Draw a molecular frame with optional properties and labels."""
        atom_fields = ['x', 'y', 'z', *atom_fields]
        atoms = frame["atoms"][atom_fields]
        atoms_arrow = pa.Table.from_pandas(atoms)

        sink = pa.BufferOutputStream()
        with pa.ipc.new_stream(sink, atoms_arrow.schema) as writer:
            writer.write_table(atoms_arrow)
        atoms_buffer = sink.getvalue()
        buffers = [atoms_buffer]

        # If bonds exist, convert and send them too
        bonds = frame.get("bonds", None)
        if bonds is not None:
            # pandas.DataFrame change colume name to bond_i and bond_j
            bond_info = bonds[['i', 'j']].rename(columns={'i': 'bond_i', 'j': 'bond_j'})
            bonds_arrow = pa.Table.from_pandas(bond_info)
            sink = pa.BufferOutputStream()
            with pa.ipc.new_stream(sink, bonds_arrow.schema) as writer:
                writer.write_table(bonds_arrow)
            bonds_buffer = sink.getvalue()
            buffers.append(bonds_buffer)

        self.send_cmd("draw_frame", {}, buffers)

        return self
