# Interaction

Molvis isn't a movie; it's a video game. You interact with it.

## What are Modes?

We define different "Modes" to handle user input. The mouse does different things depending on the active mode.

*   **View Mode:** The default. Left click rotates, right click pans, scroll zooms. You are an observer floating in space.
*   **Select Mode:** You can click on atoms to select them. This is useful for highlighting residues or picking atoms for calculation.
*   **Edit Mode:** (Advanced) Move atoms around. Yes, you can tweak the geometry.

## Why modes?

Because a mouse only has so many buttons. Overloading controls is confusing. By explicitly switching modes, we keep the interaction clean and predictable.

## How to use them?

### Switching Modes

**Python:**
```python
scene.set_mode("select")
# Now clicking on atoms highlights them
```

**Core:**
```typescript
import { ModeType } from "@molvis/core";

app.setMode(ModeType.Select);
```

### Handling Selections

When you select atoms in the viewer, that information is synced back to your code.

**Python:**
```python
# In a Jupyter cell
selection = scene.get_selection()
print(f"You selected atoms: {selection}")
```

You can also programmatically select atoms:

```python
# Select atoms with indices 0, 1, and 5
scene.select([0, 1, 5])
```

This bidirectional sync is powerful. You can run a sophisticated query in Python (e.g., "all carbons within 5A of the ligand"), calculate the indices, and then highlight them in the viewer instantly.
