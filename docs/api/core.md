# Core Library Reference

The `@molvis/core` package is the TypeScript foundation of the viewer.

## `mountMolvis`

```typescript
function mountMolvis(container: HTMLElement, config?: MolvisConfig): MolvisApp
```

Initializes and mounts a new Molvis application instance into the provided DOM element.

**Parameters:**

*   `container` (HTMLElement): The DOM element where the viewer will be rendered. It should have a defined width and height.
*   `config` (MolvisConfig, optional): Configuration object to customize the initial state (e.g., background color, UI visibility).

**Returns:**

*   `MolvisApp`: The controller instance for the created application.

---

## `class MolvisApp`

The main entry point for controlling the Molvis application.

### Properties

*   `canvas`: The HTMLCanvasElement being used for rendering.
*   `world`: The `World` instance managing the 3D scene.
*   `settings`: The `Settings` manager for user preferences.
*   `commands`: The `CommandRegistry` for executing named commands.

### Methods

#### `start()`

```typescript
start(): void
```

Starts the rendering loop. The scene will begin updating and rendering to the canvas.

#### `stop()`

```typescript
stop(): void
```

Pauses the rendering loop. Use this to save resources when the viewer is not visible.

#### `destroy()`

```typescript
destroy(): void
```

Completely disposes of the application. This removes the canvas, cleans up event listeners, and destroys the WebGL engine. **Must be called** before removing the container from the DOM.

#### `renderFrame()`

```typescript
renderFrame(frame: Frame, options?: any): void
```

Renders a molecular frame.

*   `frame`: The `Frame` object (from `molrs-wasm` or constructed manually) containing the molecular data.
*   `options`: Optional rendering parameters (style, color scheme).

#### `setMode()`

```typescript
setMode(mode: ModeType): void
```

Switches the current interaction mode.

*   `mode`: `ModeType.View`, `ModeType.Select`, or `ModeType.Edit`.

#### `resize()`

```typescript
resize(): void
```

Forces the engine to recalculate the canvas size based on the container's current dimensions. Call this if the container is resized programmatically (e.g., a split-pane drag).

---

## `enum ModeType`

Defines the available interaction modes.

*   `View` ("view"): Default camera navigation.
*   `Select` ("select"): Atom selection.
*   `Edit` ("edit"): Geometry manipulation.
