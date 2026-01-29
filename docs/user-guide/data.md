# Data, Pipeline, and Rendering

At the heart of Molvis is the data processing pipeline. We don't just "draw atoms"; we take raw molecular data and pass it through a configurable series of operations to produce the final 3D image. This architecture allows for extreme flexibility in how you visualize your systems.

## The Frame

The basic unit of data in Molvis is the `Frame`. A Frame represents the state of the system at a single point in time. It contains:

*   **Positions:** Arrays of X, Y, Z coordinates.
*   **Topology:** Information about atoms (elements, names) and bonds (connectivity, order).
*   **Properties:** Arbitrary data like temperature, partial charge, or selection state.

We decouple the Frame (data) from the Scene (view). This means you can load a trajectory with 10,000 frames but only render one at a time, keeping memory usage low.

## The Modifier Pipeline

When you ask Molvis to "draw" a frame, it doesn't go straight to the GPU. Instead, the data flows through a **Modifier Pipeline**. This is similar to the modifier stack in 3D modeling software like Blender.

1.  **Source:** The raw Frame enters the pipeline.
2.  **Selection/Filtering:** Modifiers can filter the data. For example, a "Selection Modifier" might pass only the protein backbone atoms to the next stage.
3.  **Representation:** The data is transformed into geometry. A "Ball & Stick" modifier generates spheres and cylinders. A "Cartoon" modifier generates ribbons.
4.  **Coloring:** The geometry is painted. You can color by element (CPK), by chain, by secondary structure, or by physical property.

This pipeline approach means you can mix and match. You can have the ligand shown as "Ball & Stick" colored by element, while the protein is shown as "Cartoon" colored by residue index, all in the same scene.

## Representation Types

Molvis supports several standard representations out of the box:

*   **Ball & Stick:** The classic chemistry view. Atoms are spheres, bonds are cylinders. Great for small molecules and detailed binding site inspection.
*   **Licorice:** Similar to Ball & Stick but with same-radius cylinders. Cleaner for dense visualizations.
*   **VdW (Van der Waals):** Atoms are drawn at their full physical radius. Useful for checking packing and voids.
*   **Surface (Coming Soon):** Solvent accessible surface area.

## Integration with Molpy

For Python users, `molpy` is the preferred way to generate data. The integration is seamless. You create a `molpy.Frame`, populate it with atoms, and pass it to `scene.draw_frame()`.

Behind the scenes, we serialize the Frame into a highly optimized binary format (using NumPy buffers) to send it to the frontend. This ensures that even large systems with tens of thousands of atoms load instantly.

```python
import molpy as mp
import molvis as mv

# Create a simple water molecule
frame = mp.Frame()
frame.add_atom("O", [0, 0, 0])
frame.add_atom("H", [0.75, 0.58, 0])
frame.add_atom("H", [-0.75, 0.58, 0])
frame.add_bond(0, 1)
frame.add_bond(0, 2)

# Draw it
# This implicitly sets up a default pipeline:
# Source -> Ball & Stick -> Color by Element -> Screen
mv.Molvis().draw_frame(frame)
```

By understanding this pipeline, you aren't limited to default views. You can build complex visualizations that highlight exactly the scientific story you want to tell.
