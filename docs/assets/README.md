# Screenshots

Drop `.png` / `.webp` screenshots in this directory. Filenames referenced
from the docs:

| File | Page | What it shows |
|---|---|---|
| `hero.png` | `docs/index.md` | Landing hero — a solvated protein with the simulation box outlined, full three-panel layout visible |
| `viewport.png` | `getting-started/web.md` | The viewport with a loaded structure, camera controls labeled |
| `modes.png` | `getting-started/web.md` | The five-mode selector in the top bar |
| `pipeline.png` | `getting-started/web.md` | The pipeline panel with several modifiers stacked |
| `edit-builder.png` | `getting-started/web.md` | Edit mode → Builder tab with a SMILES input and a preview |
| `measure.png` | `getting-started/web.md` | Measure mode with a distance, angle, and dihedral placed on a structure |
| `screenshot-dialog.png` | `getting-started/web.md` | The export dialog with preview, frame, and DPI controls |
| `vscode-editor.png` | `getting-started/vscode.md` | A `.pdb` file open in the VSCode custom editor |
| `vscode-quickview.png` | `getting-started/vscode.md` | Quick View side-by-side with the text editor |

## Conventions

- Target width: **1600 px**. Zensical scales images responsively; use a
  2x asset for retina.
- Crop away OS chrome. VSCode screenshots keep the editor tabs; web
  screenshots keep the browser URL bar only on the landing hero.
- Show a real structure, not a synthetic cube — pick something from
  `core/examples/` or the PDB (e.g. 1TQN).
- Dark theme preferred for the landing hero; the rest can mix.

## Excluding from the build

This README is written in markdown but is **not** listed in
`zensical.toml`'s `nav`, so it does not appear in the built site.
