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
    ESM = "http://localhost:5173/src/index.ts?anywidge"
    CSS = ""
else:
    # from `npx vite build`
    bundled_assets_dir = pathlib.Path(__file__).parent.parent / "static"
    ESM_path = bundled_assets_dir / "molvis.js"
    assert ESM_path.exists(), f"{ESM_path} not found"
    ESM = ESM_path.read_text()
    CSS = (bundled_assets_dir / "style.css").read_text()


class Molvis(anywidget.AnyWidget):

    _esm = ESM
    _css = CSS

    width = traitlets.Int(800).tag(sync=True)
    height = traitlets.Int(600).tag(sync=True)
    ready = traitlets.Bool(False).tag(sync=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

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
    
    def draw_struct(self, struct: mp.Struct):
        atoms = {
            'id': [int(atom.id) for atom in struct.atoms],
            'xyz': [atom['xyz'].tolist() for atom in struct.atoms],
            'props': {
                'element': [atom['element'] for atom in struct.atoms],
            }
        }
        bonds = {
            'i': [int(bond.itom.id) for bond in struct.bonds],
            'j': [int(bond.jtom.id) for bond in struct.bonds],
        }
        self.send_cmd("draw_frame", {'atoms': atoms, 'bonds': bonds}, [])
        return self

    def draw_frame(self, frame: mp.Frame):
        atoms = {
            'id': frame['atoms']['id'].to_pylist(),
            'x': frame['atoms']['x'].to_pylist(),
            'y': frame['atoms']['y'].to_pylist(),
            'z': frame['atoms']['z'].to_pylist(),
            'props': {}
        }
        bonds = {
            'i': frame['bonds']['i'].to_pylist(),
            'j': frame['bonds']['j'].to_pylist(),
        }
        self.send_cmd("draw_frame", {'atoms': atoms, 'bonds': bonds}, [])
        return self

    def draw_system(self, system: mp.System):
        self.draw_frame(system.frame)
        return self