# @molvis/widget

Jupyter widget integration for MolVis molecular visualization.

## Installation

```bash
pip install molvis
```

## Quick Start

```python
import molvis as mv
import molpy as mp

# Create a named scene and shared frontend session
scene = mv.Molvis(
    name="protein_view",
    session="protein_session",
    width=800,
    height=600,
)

# Draw a molecular frame
frame = mp.Frame(...)
scene.draw_frame(frame)

# Display the widget
scene
```

## Named Scenes API

Create and manage multiple visualization scenes:

```python
# Create named scenes
view1 = mv.Molvis(name="structure1")
view2 = mv.Molvis(name="structure2")

# Retrieve a scene by name
view1 = mv.Molvis.get_scene("structure1")

# List all scenes
scenes = mv.Molvis.list_scenes()  # ['structure1', 'structure2']

# Close a scene
view1.close()
```

## Shared Sessions

Multiple widget handles can point at the same frontend session:

```python
main = mv.Molvis(name="main-view", session="shared-protein")
mirror = mv.Molvis(name="secondary-view", session="shared-protein")

main.draw_frame(frame)
```

Display `main` in one cell and `mirror` in another cell to reuse the same frontend scene state and Babylon.js engine. Only one output cell is active for a shared session at a time; activating another cell re-attaches the live session there.

## Binary Transport

MolVis automatically sends numeric NumPy arrays through anywidget binary buffers instead of expanding them into JSON lists. This keeps large atom and bond arrays practical for notebook use.

## Drawing Methods

```python
scene = mv.Molvis(name="demo")

# Draw a frame
scene.draw_frame(frame, style="ball_and_stick")

# Draw a simulation box
scene.draw_box(box, color="#FF0000")

# Draw individual atoms
scene.draw_atoms(atoms, style="spacefill")

# Clear the scene
scene.clear()
```

State-changing commands wait for a JSON-RPC acknowledgement from the frontend. If the frontend rejects a command or the MolVis runtime throws during execution, Python raises `mv.MolvisRpcError`.

```python
try:
    scene.draw_frame(frame)
except mv.MolvisRpcError as exc:
    print(exc.code, exc)
```

## Development

Build the TypeScript widget:

```bash
cd python
npm install
npm run build
```

Build in watch mode:

```bash
npm run dev
```

## Test

```bash
npm run test
```

## Packaging

The Python package expects the frontend bundle at `src/molvis/dist/index.js`.
Build the widget bundle before creating a wheel or sdist:

```bash
cd python
npm run build
python3 -m build --no-isolation
```
