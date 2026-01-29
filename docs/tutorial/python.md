# Your First Molecule in Jupyter

So you've got your data in Python and you want to see it. You are in the right place. Let's fire up a Jupyter Notebook and make some magic happen.

## What are we doing?

We are going to initialize a Molvis scene inside a Jupyter widget and draw a simple molecular structure into it. By the end of this page, you'll have an interactive 3D viewer right there in your cell output.

## Why use the Jupyter Widget?

Because context switching kills flow. You don't want to save a PDB file, open PyMOL, load the file, realize it's wrong, go back to code, rinse, and repeat. You want to see the changes immediately as you manipulate your data structures. Molvis brings the visualization to your data, not the other way around.

## How do we do it?

First, make sure you have `molvis` and `molpy` installed. Then, it's just a matter of creating a scene and feeding it a frame.

Here is the complete snippet to get you going:

```python
import molvis as mv
import molpy as mp

# 1. Create a scene
# This gives you a canvas to paint on. We'll give it a name so we can find it later.
scene = mv.Molvis(name="my_first_view", width=800, height=600)

# 2. Display the widget
# Just typing the variable name in a cell renders the viewer.
# It might look empty right now, but that's just because we haven't drawn anything yet!
display(scene)

# 3. Create some data
# We'll use molpy to read a file or create a dummy molecule.
# Let's assume you have a 'protein.pdb' or we can just make a simple frame.
# For this example, let's pretend we have a frame ready.
frame = mp.Frame()
# ... (imagine we added atoms to this frame) ...

# 4. Draw it!
# This sends the data to the viewer.
scene.draw_frame(frame)
```

That's it! You should see your molecule. You can rotate with the left mouse button, pan with the right, and zoom with the scroll wheel.

If you ever lose track of your scene variable but know you named it "my_first_view", you can grab it back anytime:

```python
scene = mv.Molvis.get_scene("my_first_view")
```

Easy, right?
