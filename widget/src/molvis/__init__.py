import pathlib
import anywidget
import traitlets
import logging
import json

import molpy as mp

logger = logging.getLogger("molvis-widget-py")

__version__ = "0.1.0"

_DEV = True

if _DEV:
    # from `npx vite`
    ESM = "http://localhost:5173/src/index.ts?anywidget=1"
    CSS = ""
else:
    # from `npx vite build`
    bundled_assets_dir = pathlib.Path(__file__).parent / "static"
    ESM_path = bundled_assets_dir / "molvis.js"
    assert ESM_path.exists(), f"{ESM_path} not found"
    ESM = ESM_path.read_text()
    CSS = (bundled_assets_dir / "style.css").read_text()


class Molvis(anywidget.AnyWidget):

    _esm = ESM
    _css = CSS

    width = traitlets.Int(800).tag(sync=True)
    height = traitlets.Int(600).tag(sync=True)

    def send_cmd(self, method: str, params:dict, buffers: list):
        jsonrpc = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        }
        self.send(json.dumps(jsonrpc), buffers=buffers)
        logger.info(f"send_cmd: {method} {params}")
        return self

    def draw_atom(self, atom: mp.Atom):

        atom_dict = atom.to_dict()
        self.send_cmd("draw_atom", atom_dict, [])
        return self
    
    def draw_bond(self, bond: mp.Bond):
        self.send_cmd("draw_bond", bond.to_dict(), [])
        return self
    
    def draw_struct(self, struct: mp.Struct, extra_atom_props: list[str], label: str|list[str]|None = None):
        
        frame = struct.to_frame()
        self.draw_frame(frame, extra_atom_props, label)

        return self

    def label_atom(self, labels: list[str]):
        self.send_cmd("label_atom", {"labels": labels}, [])
        return self

    def draw_frame(self, frame: mp.Frame, extra_atom_props: list[str], label: str|list[str]|None = None):
        atoms = {
            'name': frame['atoms']['name'].to_numpy(),
            'x': frame['atoms']['x'].to_numpy(),
            'y': frame['atoms']['y'].to_numpy(),
            'z': frame['atoms']['z'].to_numpy(),
        }

        for prop in extra_atom_props:
            atoms[prop] = frame['atoms'][prop].to_numpy()

        bonds = {
            'i': frame['bonds']['i'].to_numpy(),
            'j': frame['bonds']['j'].to_numpy(),
        }

        if label is not None:
            if isinstance(label, str):
                labels = frame['atoms'][label].to_numpy()
            elif isinstance(label, (list, tuple)):
                assert len(label) == len(frame['atoms'])
                assert all(isinstance(l, str) for l in label)
                labels = label

        self.send_cmd("draw_frame", {'atoms': atoms, 'bonds': bonds}, [])
        self.label_atom(labels)
        return self

    def draw_system(self, system: mp.System):
        self.draw_frame(system.frame)
        return self