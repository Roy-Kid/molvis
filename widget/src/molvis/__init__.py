import pathlib
import anywidget
import traitlets

_DEV = True  # switch to False for production

if _DEV:
    # from `npx vite`
    ESM = "http://localhost:5173/src/index.ts?anywidget=1"
    CSS = ""
else:
    # from `npx vite build`
    bundled_assets_dir = pathlib.Path(__file__).parent.parent / "static"
    ESM = (bundled_assets_dir / "index.js").read_text()
    CSS = (bundled_assets_dir / "style.css").read_text()


class Molvis(anywidget.AnyWidget):
    _esm = ESM
    _css = CSS

    _width = traitlets.Int(800).tag(sync=True)
    _height = traitlets.Int(600).tag(sync=True)

    def __init__(self, width: int = 800, height: int = 600, **kwargs):
        super().__init__(**kwargs)
        self._width = width
        self._height = height

    def send_cmd(self, method: str, **params):
        self.send(
            {
                "type": "cmd",
                "cmd": {"jsonrpc": "2.0", "method": method, "params": params},
            }
        )

    def add_atom(self, x: float, y: float, z: float, **props):
        print(f"add_atom: {x=}, {y=}, {z=}, {props=}")
        self.send_cmd("add_atom", x=x, y=y, z=z, props=props)
