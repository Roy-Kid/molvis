# Getting Started

MolVis ships in two flavors for end users:

- the **[web app](web.md)** (`page`), hosted on
  [molcrafts.github.io/molvis](https://molcrafts.github.io/molvis/) or
  served from your own machine with `npm run dev:page`, and
- the **[VSCode extension](vscode.md)** (`molvis`), which registers a
  custom editor for `.pdb`, `.xyz`, `.data`, `.dump`, and `.lammpstrj`
  files so you can open a molecule the same way you open any other file.

Both frontends wrap the same
[`@molcrafts/molvis-core`](../api/typescript.md) engine, so the canvas
behaves identically in either place: the same modes, the same pipeline,
the same keyboard shortcuts. Pick whichever matches your workflow.

## Choosing

| | Web app | VSCode extension |
|---|---|---|
| **Install** | visit a URL, or `npm run dev:page` locally | one click from the VSCode Marketplace |
| **Opens files from** | drag & drop, "Load" button, `?file=` URL param | any file in your workspace, including over SSH |
| **Persistent state** | no (per-tab only) | yes (VSCode remembers viewer options per workspace) |
| **Python / Jupyter workflow** | separate notebook ([widget API](../api/python.md)) | separate notebook ([widget API](../api/python.md)) |
| **Scripting** | browser console (`window.__MOLVIS_APP__`) | extension host (message API, see below) |

If you are iterating on a set of trajectory files sitting next to your
LAMMPS input deck, the VSCode extension is the fastest path. If you want
to share a single viewer with collaborators without installing anything,
use the web app.

## Once it's open

Regardless of frontend, the viewport supports the same basics:

- **Orbit** with left-drag, **pan** with middle-drag (or shift+left),
  **zoom** with the scroll wheel.
- Press **`1`–`5`** to switch to *View*, *Select*, *Edit*, *Manipulate*,
  or *Measure* mode.
- Press **`?`** to open the keyboard shortcuts cheatsheet.
- Press **`Ctrl/Cmd+Z`** to undo, **`Ctrl/Cmd+Shift+Z`** to redo — every
  action is a first-class command.
- Press **`F`** to reset the camera to fit the current frame.

The rest of this section walks through each frontend in detail.
