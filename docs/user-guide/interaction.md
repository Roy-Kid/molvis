# Interaction Modes and Controls

Molvis is designed to be interactive, functioning more like a game engine than a static image viewer. To manage the complexity of mouse and keyboard inputs, we segregate interaction logic into distinct "Modes". Each mode changes how the viewer interprets your actions, allowing for precise control whether you are just looking around or selecting specific atoms for analysis.

## View Mode

This is the default state of the application. In View Mode, you are an observer floating in space. The goal here is navigation. We use an arc-ball style camera control which feels intuitive for inspecting centered objects like proteins.

*   **Left Click + Drag:** Rotates the camera around the focal point.
*   **Right Click + Drag:** Pans the camera (moves the focal point).
*   **Scroll Wheel:** Zooms in and out.

We designed it this way because 90% of the time, you just want to see the molecule from different angles. By dedicating the primary mouse buttons to navigation, we ensure that you don't accidentally modify the scene or select atoms when you just meant to turn the view.

## Select Mode

When you need to interact with the data itself, you switch to Select Mode. Here, the mouse becomes a pointer.

*   **Left Click:** Selects the atom under the cursor.
*   **Shift + Left Click:** Adds or removes an atom from the current selection (toggle).
*   **Background Click:** Clears the selection.

When an atom is selected, it emits an event. In the Jupyter environment, this syncs back to your Python kernel, allowing you to use the 3D viewer as an input device. You can pick a residue in 3D and immediately run a script on that residue in Python.

## Edit Mode (Experimental)

For users who need to manipulate the structure, Edit Mode unlocks geometry modification.

*   **Click + Drag on Atom:** Moves the atom in the screen plane.

This is useful for quick structural adjustments or setting up initial constraints for simulations. We keep this separate from View and Select modes to prevent accidental data corruption.

## Switching Modes

You can switch modes programmatically or via the UI (if enabled).

In Python:
```python
scene.set_mode("select")
```

In TypeScript:
```typescript
import { ModeType } from "@molvis/core";
app.setMode(ModeType.Select);
```

By explicitly managing these states, we keep the interface clean and predictable, avoiding the "what does this button do now?" confusion common in complex software.
