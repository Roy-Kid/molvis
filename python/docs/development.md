# Development

## Setup

``` bash
git clone https://github.com/molcrafts/molvis
cd molvis
npm install
```

## Build

### Jupyter widget bundle

``` bash
cd python
npm run build       # production build
npm run dev         # watch mode
```

### Standalone viewer assets

``` bash
npm run build:standalone   # builds page app + copies to python/src/molvis/page_dist/
```

### Full build

``` bash
npm run build:all
```

## Development workflow

### Live reload for standalone viewer

Use two terminals:

=== "Terminal 1 -- page dev server"

    ``` bash
    npm run dev:page
    ```

=== "Terminal 2 -- Python with dev assets"

    ``` bash
    MOLVIS_PAGE_DIST=page/dist python test_molvis.py
    ```

The `MOLVIS_PAGE_DIST` environment variable overrides the bundled page assets, pointing to the dev server's output for live reload.

## Testing

``` bash
# Core tests (rstest)
npm test

# Python tests (pytest)
cd python
pytest
```

## Packaging

``` bash
npm run build:standalone
cd python
npm run build
python3 -m build --no-isolation
```

## Project structure

``` text
python/
  src/molvis/
    __init__.py          # Public API: Molvis, StandaloneMolvis, show
    scene.py             # Molvis (anywidget) class
    standalone.py        # StandaloneMolvis + show()
    server.py            # HTTP + WebSocket server
    ws_transport.py      # WebSocket transport (binary framing)
    transport.py         # anywidget transport (binary buffers)
    transport_base.py    # Transport protocol definition
    commands/            # Command mixins (drawing, selection, snapshot, frame)
    dist/                # Built anywidget ESM bundle
    page_dist/           # Built standalone page app (gitignored)
```
