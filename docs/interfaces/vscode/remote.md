# Remote, WSL, and container workspaces

MolVis separates the extension host from the webview renderer. In SSH, WSL, and
Dev Container sessions the extension host reads remote files while the local VS
Code window renders the WebGL canvas.

## File flow

1. You choose a resource through Explorer or **Open Structure…**.
2. The remote extension host stats the file and picks a format.
3. **Structures** (LAMMPS `.data`, POSCAR, single-frame GRO, …) are read
   through VS Code's file-system API and transferred to the webview as one
   payload. Size is not a MolVis refusal; the provider may still fail.
4. **Streamable trajectories** (LAMMPS dump, XYZ, PDB, SDF, DCD, XTC, TRR)
   on a `file:` URI send `openUri`. The webview pulls `[start, end)` slices
   with `readRange`; the host answers from a positional `fs.read`. The whole
   file is not copied into the extension host or across Remote IPC.
5. **Structures** and small non-stream files still use a one-shot `loadFile`.
   Eager-only trajectories at or above 512 MiB are refused.

Explorer drag-and-drop of a workspace uri still goes through the extension
host. A file dropped *onto the webview* from the local machine uses the
browser `File` handle and can stream without a full host copy.

## Save flow

Save reverses the route: the webview exports the current frame, the extension
serializes/receives the payload, and VS Code's provider writes it remotely.
Normal workspace permissions still apply.

## Performance considerations

- File transfer time depends on the remote connection.
- Rendering uses the GPU available to the local VS Code window.
- Hundred-GB dumps can play after the first frame is indexed. The first
  open still scans near the data (index-near-data writes `.molidx` beside
  the file or in workspace cache).
- Avoid opening many independent Quick Views because every interactive viewer
  owns a WebGL context.

Use the MolVis Output channel to distinguish remote read failures from local
webview/GPU failures.

Continue with [Troubleshooting](troubleshooting.md).
