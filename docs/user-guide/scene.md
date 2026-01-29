# Scene Management and Architecture

The `Scene` (or `MolvisApp` in the core library) is the container for your visualization. It manages the lifecycle of the 3D engine, the connection to the DOM, and the communication between Python and JavaScript.

## The Widget Lifecycle (Python)

When you run `scene = mv.Molvis()` in a Jupyter notebook, several things happen:

1.  **Python Object Creation:** A `Molvis` instance is created in the Python kernel. It generates a unique Session ID.
2.  **Frontend Sync:** The `anywidget` framework instructs the Jupyter frontend to create a corresponding JavaScript view.
3.  **Connection:** The two sides establish a communication channel.

Because of this split, the "Scene" exists in two places at once. We use a **Global Registry** pattern in Python to keep track of these instances. This is why you can retrieve a scene by name later.

```python
# Cell 1
scene = mv.Molvis(name="prot_1")

# Cell 2 (or a different notebook connected to the same kernel)
# You don't need to pass the variable. You can look it up.
s = mv.Molvis.get_scene("prot_1")
```

This design is crucial for interactive analysis. You might create a view, do some heavy computation in a different function, and then want to push the results back to that view without threading the object through your entire call stack.

## The Application Lifecycle (Core)

In the web environment, you are responsible for the lifecycle.

*   **Mounting:** `mountMolvis(element)` attaches the engine to a `div`. It sets up the WebGL context and event listeners.
*   **Starting:** `app.start()` kicks off the requestAnimationFrame loop.
*   **Destroying:** `app.destroy()` is critical. If you remove the `div` from the DOM without calling this, the WebGL context will hang around in memory. Browsers have a limit on how many WebGL contexts can be active (usually around 16). If you hit this limit, your visualizations will stop working.

## Communication Protocol

We use a custom JSON-RPC based protocol for communication. When you call `scene.draw_frame(frame)`, we don't just send JSON. We strip out the heavy numerical arrays (positions, colors) and send them as raw binary buffers alongside the JSON command. This "zero-copy" approach allows us to stream millions of atoms without the overhead of base64 encoding or JSON parsing on the main thread.

We designed this robust architecture because molecular visualization is resource-intensive. By carefully managing memory and communication, we ensure that Molvis remains responsive even when you are pushing it to its limits.
