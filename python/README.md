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

# Create a named scene
scene = mv.Molvis(name="protein_view", width=800, height=600)

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

## Development

Build the TypeScript widget:

```bash
cd widget
npm install
npm run build
```

Build in watch mode:

```bash
npm run dev
```
