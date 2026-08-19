# VS Code

The MolVis extension integrates molecular files with VS Code's editor,
workspace, remote-file, command, and settings APIs. It is not a separate
renderer: its webviews host the same stage engine as the web product, with a
VS Code–specific host protocol for files and settings.

## Choose a surface

| Surface | Use it when |
|---|---|
| Stage | 3D session in an editor tab |
| Sketch | 2D session in an editor tab |
| Quick View | Light 3D peek beside the source text |
| Files | Workspace molecular files and recent paths |
| Stage outline | Hierarchy of the open Stage tab (hidden until loaded) |
| Sketch outline | Atoms and bonds of the open Sketch tab (hidden until loaded) |

## Read this section

1. [Install and verify the extension](install.md)
2. [Open files with Quick View](quick-view.md)
3. [Use Stage and Sketch](workspace.md)
4. [Configure core and runtime settings](configuration.md)
5. [Work locally, over SSH, WSL, and containers](remote.md)
6. [Troubleshoot webviews and file loading](troubleshooting.md)
