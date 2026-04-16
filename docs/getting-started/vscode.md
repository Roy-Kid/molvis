# VSCode extension

The MolVis VSCode extension (`molvis.molvis` on the Marketplace) turns
any chemistry file in your workspace into an interactive 3D viewer. No
configuration is required; installing it is enough.

## Install

- **Marketplace** — search "MolVis" in the Extensions view (`Ctrl+Shift+X`)
  and click *Install*. Or visit
  [marketplace.visualstudio.com/items?itemName=molcrafts.molvis](https://marketplace.visualstudio.com/items?itemName=molcrafts.molvis).
- **Open VSX** — available at
  [open-vsx.org/extension/molcrafts/molvis](https://open-vsx.org/extension/molcrafts/molvis)
  for VSCodium / Cursor users.
- **VSIX** — download `molvis-<version>.vsix` from the
  [releases page](https://github.com/molcrafts/molvis/releases) and run
  **Extensions: Install from VSIX…** from the command palette.

The extension supports VSCode 1.108.1 or newer.

## Open a file

### As the editor

Right-click a `.pdb`, `.xyz`, `.data`, `.dump`, or `.lammpstrj` file in
the explorer and choose **Open With… → MolVis Viewer**. To make MolVis
the default editor for a format, pick **Configure default editor for
`*.pdb`**.

The viewer is a full custom editor: the file remains the document of
record, `Ctrl/Cmd+S` writes the current pipeline output back to disk,
and the editor tab shows a dot when there are unsaved changes.

### Side-by-side (Quick View)

If you want to keep the raw text and the viewer visible at the same
time, right-click the file and choose **MolVis: Quick View**. This
opens the viewer in a second editor column while leaving the text
editor in the first.

### Standalone

**MolVis: Open Editor** (command palette) opens an empty workspace
viewer. Drag files from the Explorer onto the canvas to load them —
this works across SSH remote sessions too, since the extension host
reads the bytes and forwards them to the webview.

## The viewer

The viewer in VSCode is the same three-panel React app as the
[standalone web app](web.md). Modes, pipeline, selection, measurement,
screenshot export — everything behaves identically. Read the web app
guide for feature details.

A few interactions are VSCode-specific:

- **Save** (`Ctrl/Cmd+S`) — serializes the current pipeline output to
  the file format implied by the document's extension and writes it
  through VSCode's file system provider. Works over SSH remote and
  WSL. For read-only formats (Zarr directories), Save is disabled.
- **Reload** (`MolVis: Reload` command) — reloads the webview without
  reopening the file, handy when you've edited the file in an external
  tool.
- **Drag & drop** — dragging a file from the Explorer onto the canvas
  replaces the current document. The VSCode extension host handles
  reading the bytes, so it works on SSH remote.

## Configuration

The extension reads two blocks from your workspace or user settings:

### `molvis.config`

Passed to the core engine at mount time. Same shape as the
[`MolvisConfig`](../api/typescript.md#molvisconfig) object you would
pass to `mountMolvis`.

```jsonc
{
  "molvis.config": {
    "showUI": true,
    "useRightHandedSystem": true,
    "canvas": { "antialias": true, "alpha": false }
  }
}
```

### `molvis.settings`

Runtime overrides applied after mount. Same shape as the
[`MolvisSetting`](../api/typescript.md#molvissetting) object.

```jsonc
{
  "molvis.settings": {
    "cameraZoomSpeed": 1.5,
    "grid": { "enabled": true, "size": 100, "opacity": 0.3 },
    "graphics": { "fxaa": true, "hardwareScaling": 1.0 }
  }
}
```

Changes to either block take effect on the next *Reload*.

## Troubleshooting

**"Cannot display file: WebGL is not supported."**  
VSCode's webview sandbox needs GPU compositing. On Linux, enable
hardware acceleration in VSCode (`settings.json` → `"disable-hardware-acceleration": false`)
or launch with `--enable-gpu-rasterization`.

**The viewer is blank after saving a large file.**  
Check the *Output* channel (**MolVis** dropdown). Files over ~200 MB
may exceed the VSCode webview message limit; use the
[web app](web.md) + `npm run dev:page` for extreme cases.

**Python widget and the extension conflict.**  
They don't share state. Running both is fine, but selections made in
VSCode are not mirrored to the notebook cell.
