# Core Library Reference

The `@molvis/core` package provides the TypeScript rendering engine.

## Functions

### `mountMolvis(container, config?) -> MolvisApp`

Initializes a Molvis application inside the given DOM element.

*   **container** *(HTMLElement)*: The DOM element to render into.
*   **config** *(MolvisConfig, optional)*: Initial configuration options.

Returns a `MolvisApp` instance.

## `class MolvisApp`

The main controller for the visualization.

### Methods

#### `start()`

Starts the rendering loop. The canvas will update on every frame.

#### `stop()`

Stops the rendering loop. Used to save battery or when the tab is hidden.

#### `destroy()`

Cleans up all resources, removes event listeners, and destroys the WebGL context. Call this when removing the component.

#### `renderFrame(frame, options?)`

Renders a frame.

*   **frame**: A `Frame` object containing atoms and bonds.
*   **options**: Rendering options.

#### `setMode(mode: ModeType)`

Switches the interaction mode.

*   **mode**: One of `ModeType.View`, `ModeType.Select`, or `ModeType.Edit`.

#### `resize()`

Forces the engine to resize the canvas to match the container's current dimensions. Call this if your layout changes dynamically.
