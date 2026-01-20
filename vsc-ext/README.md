# MolVis VSCode Extension

A VSCode extension for visualizing molecular structures directly within your editor. Built on [Babylon.js](https://www.babylonjs.com/) and the MolVis rendering engine.

## Features

### 🔬 Molecular Visualization

- **Custom Editor for .pdb files**: Open `.pdb` files in an interactive 3D viewer
- **Side-by-side text/visualization**: Click the preview button in the editor title bar to view molecular structure alongside the text
- **Command-based viewer**: Open an empty viewer and drag-and-drop molecular files
- **Real-time updates**: Changes to the text file automatically update the visualization

### 🎯 Workflows

#### 1. Open .pdb file in MolVis viewer

1. Open any `.pdb` file in VSCode
2. Right-click the editor tab → **Reopen Editor With...** → **MolVis Viewer**
3. The file will open in the 3D molecular viewer

#### 2. Preview to the side (Markdown-style)

1. Open a `.pdb` file in the text editor
2. Click the **Open Preview to the Side** button (📖) in the editor title bar
3. The molecular visualization will open in a split view alongside your text editor

#### 3. Standalone viewer with drag-and-drop

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run **MolVis: Open Viewer**
3. Drag and drop a `.pdb` file from your file explorer into the viewer

## Supported File Formats

- **PDB** (`.pdb`) - Protein Data Bank format

> **Note**: This extension currently supports small text-based molecular files (< 10MB). Support for additional formats (`.xyz`, `.cif`, `.mol2`) and large files is planned for future releases.

## Requirements

- VSCode 1.108.1 or higher
- WebGL-capable browser engine (included in VSCode)

## Extension Commands

- `MolVis: Open Viewer` - Open an empty molecular viewer
- `Open Preview to the Side` - Open molecular visualization alongside text editor (available when a `.pdb` file is active)

## Known Limitations

- **Read-only visualization**: Editing molecular structures is not yet supported
- **Small files only**: Files larger than 10MB may cause performance issues
- **PDB format only**: Additional formats will be added in future releases

## Development

### Building the extension

```bash
npm install
npm run build
```

### Running in development

1. Open this folder in VSCode
2. Press `F5` to launch the Extension Development Host
3. Test the extension in the new VSCode window

## Architecture

The extension uses a dual-webview strategy:

- **Custom Text Editor**: Integrates with VSCode's document model for `.pdb` files
- **Webview Panel**: Standalone viewer for exploratory work

Both webviews use the same Babylon.js-based rendering engine from `@molvis/core`, with message passing between the extension host (Node.js) and webview (browser) for file loading and state synchronization.

## License

BSD-3-Clause - See [LICENSE](../LICENSE) for details.

## Contributing

This extension is part of the MolVis monorepo. See the [main README](../README.md) for contribution guidelines.
