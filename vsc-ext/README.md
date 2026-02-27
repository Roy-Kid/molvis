# MolVis VSCode Extension

A VSCode extension for visualizing molecular structures directly within your editor. Built on [Babylon.js](https://www.babylonjs.com/) and the MolVis rendering engine.

## Features

- **Custom Editor** for `.pdb`, `.xyz`, `.data` files with interactive 3D viewing
- **Quick View** panel for side-by-side text + visualization
- **Editor Workspace** with full React-based MolVis UI
- **Drag-and-drop** file loading onto the canvas
- **Hot reload** during development (watches build output)
- **Zarr directory** support for trajectory data
- **Configurable** camera, graphics, grid, and UI settings via `molvis.config` / `molvis.settings`

## Supported File Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| PDB    | `.pdb`    | Protein Data Bank |
| XYZ    | `.xyz`    | Multi-frame trajectory support |
| LAMMPS | `.data`   | LAMMPS data format |
| Zarr   | `.zarr`   | Directory-based binary trajectory |

## Workflows

### 1. Custom Editor

1. Open a `.pdb`, `.xyz`, or `.data` file in VSCode
2. Right-click the editor tab -> **Reopen Editor With...** -> **MolVis Viewer**

### 2. Quick View (side-by-side)

1. Open a supported file in the text editor
2. Click the **Open Preview to the Side** button in the editor title bar
3. Visualization opens alongside your text editor

### 3. Editor Workspace

1. Right-click a supported file in the Explorer -> **MolVis: Open Editor**
2. A full MolVis workspace opens with React-based UI

### 4. Drag-and-drop

Drop a molecular file directly onto any MolVis canvas to load it.

## Commands

| Command | Description |
|---------|-------------|
| `MolVis: Quick View` | Open a side-by-side preview panel |
| `MolVis: Open Editor` | Open full MolVis editor workspace |
| `MolVis: Reload` | Reload the active MolVis webview |

## Configuration

### `molvis.config`

Controls the MolVis core initialization:

```jsonc
{
  "molvis.config": {
    "showUI": true,
    "useRightHandedSystem": true,
    "ui": {
      "showInfoPanel": true,
      "showViewPanel": true,
      "showPerfPanel": true,
      "showContextMenu": true
    },
    "canvas": {
      "antialias": true
    }
  }
}
```

### `molvis.settings`

Runtime settings applied after initialization:

```jsonc
{
  "molvis.settings": {
    "cameraPanSpeed": 1.0,
    "cameraRotateSpeed": 1.0,
    "cameraZoomSpeed": 1.0,
    "cameraInertia": 0.9,
    "grid": { "enabled": true, "size": 100, "opacity": 0.5 },
    "graphics": { "fxaa": true, "hardwareScaling": 1.0 }
  }
}
```

## Architecture

```
vsc-ext/
  src/
    extension/          # Extension host (Node.js)
      activate.ts       # Entry point: registers providers, commands, watchers
      configuration.ts  # Reads molvis.config / molvis.settings
      types.ts          # Message types, Logger, PanelRegistry interfaces
      panels/
        editorProvider.ts   # CustomTextEditorProvider for .pdb/.xyz/.data
        previewPanel.ts     # Quick View side panel
        viewerPanel.ts      # Full editor workspace panel
        html.ts             # Webview HTML generation with CSP
        messaging.ts        # Host <-> webview message helpers
        hotReload.ts        # Dev file watcher for auto-reload
      loading/
        molecularFileLoader.ts      # Unified file loading (text + zarr)
        zarrDirectoryReaderCore.ts  # Recursive zarr directory reader
        pathUtils.ts                # URI / path utilities
    webview/            # Webview bundle (browser)
      index.ts          # Entry point
      controller.ts     # Bootstraps MolVis core, handles messages & drop
      loader.ts         # File parsing (PDB/XYZ/LAMMPS/Zarr)
    browser/            # Alternative webview entries
      preview.tsx       # Preview entry (uses controller.ts)
      editor.tsx        # Editor entry (uses React App from page/)
    test/
      unit/             # Mocha unit tests
      integration/      # VSCode integration tests
```

### Message Protocol

**Host -> Webview**: `init`, `applySettings`, `loadFile`, `error`

**Webview -> Host**: `ready`, `saveFile`, `error`

### Build Strategy

Three separate Rslib configurations:

- **Extension host** (`rslib.extension.config.ts`): CJS bundle for Node.js
- **Webview** (`rslib.webview.config.ts`): ESM bundle for browser, with code splitting (vendor / molvis-core / runtime) and inline WASM

## Development

### Build

```bash
npm install
npm run build          # Build everything
npm run build:extension  # Extension host only
npm run build:webview    # Webview bundles only
```

### Watch mode

```bash
npm run watch          # Watch extension + webview + typecheck
```

### Run

1. Open this folder in VSCode
2. Press `F5` to launch the Extension Development Host
3. Test the extension in the new VSCode window

### Test

```bash
npm run test           # Unit + integration
npm run test:unit      # Unit tests only
npm run test:integration  # Integration tests only
```

### Package & Deploy

```bash
npm run package        # Production build
npm run deploy:vsce    # Publish to VS Code Marketplace
npm run deploy:ovsx    # Publish to Open VSX
```

## Requirements

- VSCode 1.108.1+
- WebGL-capable browser engine (included in VSCode)

## License

BSD-3-Clause
