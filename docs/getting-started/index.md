# Getting Started

MolVis is available in three forms for end users:

- the **web viewer** at
  [molvis.molcrafts.org](https://molvis.molcrafts.org) — no install
  required,
- the **VSCode extension**, which registers a custom editor for
  `.pdb`, `.xyz`, `.data`, `.dump`, and `.lammpstrj` files, and
- the **Jupyter widget**, used from Python to render frames directly
  in a notebook cell.

All three share the same rendering engine, so the viewport behaves
identically in any of them: the same modes, the same pipeline, the
same keyboard shortcuts. Pick whichever matches your workflow.

## Which one?

| | Web viewer | VSCode extension | Jupyter widget |
|---|---|---|---|
| **Install** | nothing — open the URL | Marketplace, one click | `pip install molvis` |
| **Opens files from** | drag & drop, URL parameter | any file in your workspace, including SSH remote | a Python `Frame` you pass in |
| **Scripting** | browser console | extension messaging API | full Python API |
| **Shares state across tabs** | no | yes (per workspace) | yes (shared sessions) |
| **Offline** | yes, after first load | yes | yes |

If you're iterating on a trajectory sitting next to your LAMMPS input
deck, the VSCode extension is the fastest path. If you want to share
a viewer with a collaborator without asking them to install anything,
send them a [molvis.molcrafts.org](https://molvis.molcrafts.org) link.
If you're already in a notebook, stay in the notebook.

Guides for each:

- [**Web viewer**](web.md) — the UI, modes, pipeline, export.
- [**VSCode extension**](vscode.md) — install, open a file,
  configure.
- For the Jupyter widget, jump directly to the
  [Python API reference](../api/python.md).

## What's in every viewport

The viewport supports the same basics regardless of where you run it:

- **Orbit** with left-drag, **pan** with middle-drag (or shift +
  left-drag), **zoom** with the scroll wheel.
- Press **`1`–`5`** to switch to *View*, *Select*, *Edit*,
  *Manipulate*, or *Measure* mode.
- Press **`?`** to open the keyboard shortcuts cheatsheet.
- Press **`Ctrl/Cmd+Z`** to undo, **`Ctrl/Cmd+Shift+Z`** to redo —
  every action is a first-class command, so the full history is
  reversible.
- Press **`F`** to fit the camera to the current frame.

![The mode selector in the top bar shows the five interaction modes](../assets/modes.png)
