# Data & Drawing

If the Scene is the stage, Data is the script.

## What is a Frame?

A `Frame` is a snapshot of a molecular system at a specific point in time. It contains:
*   **Positions:** Where the atoms are (XYZ coordinates).
*   **Topology:** How atoms are connected (bonds, atom types).
*   **Properties:** B-factors, charges, or any other data you attached.

We separate the *Data* (Frame) from the *View* (Scene).

## Why separate them?

Because one dataset can be visualized in a thousand ways. You might want to see the same protein as a cartoon, as sticks, or as a surface. You might want to color it by element, or by residue index. By keeping the data pure, we can swap visualization styles without touching the underlying physics.

## How to draw?

### The Pipeline Approach

Molvis uses a "Modifier Pipeline" under the hood. When you pass a frame, it flows through a series of modifiers that transform raw data into 3D geometry.

1.  **Source:** The raw `Frame`.
2.  **Modifiers:** Filters, selections, coloring rules.
3.  **Renderer:** Generates the meshes.

### Python Example

In Python, we usually just "draw" the frame, which sets up a default pipeline for you.

```python
import molpy as mp
import molvis as mv

# Create data
frame = mp.Frame()
frame.add_atom(element="C", position=[0, 0, 0])

scene = mv.Molvis()
scene.draw_frame(frame)
```

### Core Example

In the core library, you can manually play with the pipeline, but `renderFrame` is the easiest entry point.

```typescript
// app is your MolvisApp instance
app.renderFrame(myFrame, {
    style: "ball-and-stick",  // Optional hints
    color: "element"
});
```

We support different representations like "Ball & Stick", "Licorice", "Cartoon" (coming soon), and "Surface". You can switch these dynamically.
