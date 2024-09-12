import pathlib
import anywidget
import traitlets
import logging

logger = logging.getLogger("molvis-widget-py")

_DEV = True  # switch to False for production

if _DEV:
    # from `npx vite`
    ESM = "http://localhost:5173/src/index.ts?anywidget"
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

    _width = traitlets.Int(800).tag(sync=True)
    _height = traitlets.Int(600).tag(sync=True)

    def __init__(self, width: int = 800, height: int = 600, **kwargs):
        super().__init__(**kwargs)
        self.resize(width, height)

    def resize(self, width: int, height: int):
        self._width = width
        self._height = height
        logger.info(f"resize: {width}x{height}")
        return self

    def send_cmd(self, method: str, params:dict, buffers: list):
        jsonrpc = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        }
        self.send(jsonrpc, buffers=buffers)
        logger.info(jsonrpc)

    def add_atom(self, x: float, y: float, z: float):
        self.send_cmd("add_atom", {
            "x": x,
            "y": y,
            "z": z,
        }, [])
