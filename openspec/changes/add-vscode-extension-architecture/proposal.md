# Change: VSCode Extension Architecture for MolVis Visualization

## Why

MolVis currently exists as a standalone web application and Jupyter widget, but lacks integration with VSCode, a popular development environment for computational chemistry and molecular modeling workflows. Scientists and developers working with molecular data files (e.g., `.pdb`, `.xyz`) need a seamless way to visualize these files directly within their VSCode workspace without switching to external tools.

The current `vsc-ext/` implementation only provides a basic command to open an empty viewer. It lacks:
- File association and Custom Editor integration for `.pdb` files
- Drag-and-drop support for loading molecules
- Editor title button for side-by-side text/visualization workflow
- Proper communication between extension host and webview for file loading

## What Changes

This change establishes a comprehensive architecture for the VSCode extension that enables:

1. **Command-based Empty Viewer**: A `MolVis: Open Viewer` command that opens a new tab with an empty MolVis viewer supporting drag-and-drop file loading
2. **Custom Editor Integration**: Register a Custom Text Editor for `.pdb` files, allowing users to switch between text and visualization views using VSCode's "Reopen Editor With..." mechanism
3. **Editor Title Button**: Add a button in the editor title bar (similar to Markdown preview) to open MolVis visualization alongside the text editor
4. **Webview Communication Protocol**: Define message passing between extension host and webview for file loading, error handling, and state synchronization
5. **File Access Layer**: Extension host reads file contents and sends to webview, maintaining security boundaries

This change focuses on small text-based molecular files only. Large file optimization, editing capabilities, and saving are explicitly out of scope for this phase.

## Impact

- **New capability**: `vscode-integration` spec will be created
- **Affected code**:
  - `vsc-ext/src/extension.ts` - Add Custom Editor provider, editor title button contribution
  - `vsc-ext/src/webview/index.ts` - Add message handling for file loading
  - `vsc-ext/package.json` - Register Custom Editor, commands, and editor title contributions
  - New files: `vsc-ext/src/customEditor.ts`, `vsc-ext/src/webviewMessaging.ts`
- **Dependencies**: Requires `@molvis/core` API for parsing and rendering molecular files
