# Scene Management

The "Scene" is the universe where your molecules live. It manages the camera, the lights, the canvas, and the rendering loop.

## What is a Scene?

In Molvis, the Scene (represented by `Molvis` in Python and `MolvisApp` in Core) is the top-level controller. It binds the 3D engine to a DOM element (or a Widget area) and orchestrates the show. It's the boss.

## Why manage it explicitly?

You might want to show multiple views of the same molecule side-by-side. Or maybe you need to destroy a viewer to free up WebGL resources when a user navigates away. Explicit management gives you control over the lifecycle of the heavy 3D resources.

## How to use it?

### In Python (Jupyter)

We use a global registry to keep track of your widgets. This is super handy when you define a widget in one cell and want to update it from another cell ten minutes later.

```python
import molvis as mv

# Create a named scene
view = mv.Molvis(name="main_stage", width=1000, height=800)
display(view)

# Later... somewhere else...
# You don't need to pass the variable 'view' around.
same_view = mv.Molvis.get_scene("main_stage")
same_view.send_cmd("some_command", {})
```

If you don't provide a name, we generate a random UUID for you. But names are better.

To clean up:
```python
view.close()
```

### In Core (Web)

In the browser, you attach the app to a DOM node.

```typescript
import { mountMolvis } from "@molvis/core";

const app = mountMolvis(document.getElementById("root"));

// Start the engine
app.start();

// Stop the engine (pauses rendering)
app.stop();

// Nuke it from orbit (cleanup DOM and WebGL context)
app.destroy();
```

**Pro Tip:** Always call `destroy()` when your component unmounts (e.g., in React's `useEffect` cleanup) to avoid memory leaks. WebGL contexts are precious!
