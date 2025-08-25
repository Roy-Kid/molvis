# Molvis Widget

A Jupyter widget for molecular visualization using molpy and anywidget.

## Features

- **Molecular Visualization**: Display atoms, bonds, and molecular structures
- **Multiple Visualization Styles**: Ball and stick, spacefill, and more
- **Interactive 3D Controls**: Rotate, zoom, and pan the molecular view
- **Frame Management**: Load and navigate through trajectory frames
- **UI Layer Management**: Proper layering of UI elements and canvas
- **Flexible Atom Sizing**: Element-specific radii with global and individual scaling
- **Viewport Splitting**: Split the viewport to show multiple frames simultaneously (like tmux/VSCode)

## Viewport Split Feature

The widget supports splitting the viewport into multiple sections to display different frames simultaneously:

### Usage
1. Switch to **VIEW mode** (click the VIEW button)
2. **Right-click** in the viewport area
3. Select **"Split Viewport"** from the context menu
4. Choose your split mode:
   - **Split Horizontal**: Top and bottom viewports
   - **Split Vertical**: Left and right viewports
   - **Split Quad**: Four quadrants
   - **Reset Viewport**: Return to single viewport

### Features
- Each viewport shows a different frame from the trajectory
- Independent camera controls for each viewport
- Automatic frame assignment (frames 0, 1, 2, 3 for quad split)
- Proper UI layering across all viewports

For detailed documentation, see [VIEWPORT_SPLIT_FEATURE.md](VIEWPORT_SPLIT_FEATURE.md).

## Quick Start

```python
import molvis as mv
import molpy as mp

# Create widget
canvas = mv.Molvis(width=800, height=600)

# Create a molecule
molecule = mp.Atomistic(name="example")
molecule.add_atom(mp.Atom(name="C1", element="C", xyz=[0.0, 0.0, 0.0]))
molecule.add_atom(mp.Atom(name="O1", element="O", xyz=[1.4, 0.0, 0.0]))

# Visualize
frame = molecule.to_frame()
canvas.draw_frame(frame)
canvas
```

## Installation

```bash
# From the widget directory
pip install -e .
```

## API Reference

### Molvis Widget

The main widget class for molecular visualization.

#### Constructor

```python
Molvis(width: int = 800, height: int = 600, reload: bool = False)
```

- `width`: Widget width in pixels
- `height`: Widget height in pixels  
- `reload`: Whether to reload the frontend JavaScript

#### Core Methods

##### `draw_frame(frame, style, atom_radius, bond_radius, show_box, clean)`

Draw a molecular frame with customizable styling.

```python
canvas.draw_frame(
    frame=frame,
    style="ball_and_stick",      # Visualization style
    atom_radius=None,           # Atom radius specification (see below)
    bond_radius=0.1,            # Bond radius
    show_box=True,              # Show simulation box
    clean=True                  # Clear previous visualization
)
```

**Atom Radius Options**:
- `None` (default): Use element-specific radii from palette (H=0.38, C=0.77, O=0.73, etc.)
- `float`: Global scaling factor for all atoms (e.g., 1.5 = 50% larger)
- `List[float]`: Specific radius for each atom (e.g., [0.5, 1.0, 1.5] for 3 atoms)

**Examples**:
```python
# Use element-specific sizes (default)
canvas.draw_frame(frame, atom_radius=None)

# Scale all atoms by 50%
canvas.draw_frame(frame, atom_radius=1.5)

# Set specific sizes for each atom
canvas.draw_frame(frame, atom_radius=[0.5, 1.0, 1.5, 2.0])
```

##### `set_atom_radius(radius)`

Set the radius for all atoms.

```python
canvas.set_atom_radius(None)        # Use element-specific radii
canvas.set_atom_radius(1.5)         # Scale all atoms by 50%
canvas.set_atom_radius([0.5, 1.0])  # Set specific radii for atoms
```

##### `set_bond_radius(radius)`

Set the radius for all bonds.

```python
canvas.set_bond_radius(0.15)  # Set bond radius to 0.15
```

##### `set_style(style)`

Set visualization style.

```python
canvas.set_style("spacefill")  # Change to spacefill style
```

##### `set_camera(position, target)`

Set camera position and target.

```python
canvas.set_camera(
    position=[5.0, 5.0, 5.0],  # Camera position
    target=[1.0, 1.0, 0.0]     # Look at point
)
```

##### `clear()`

Clear the visualization.

```python
canvas.clear()
```

##### `show_box(visible)`

Show or hide the simulation box.

```python
canvas.show_box(True)   # Show box
canvas.show_box(False)  # Hide box
```

#### Method Chaining

All methods return `self`, enabling method chaining:

```python
canvas.clear().draw_frame(frame, style="spacefill").set_camera([5, 5, 5], [0, 0, 0])
```

## Element-Specific Styling

The widget automatically applies element-specific styling:

- **Colors**: Each element has a predefined color (e.g., C=gray, O=red, N=blue, H=white)
- **Sizes**: Each element has a predefined radius (e.g., H=0.38, C=0.77, O=0.73, N=0.75)
- **Scaling**: Use `atom_radius` parameter to scale all atoms uniformly

### Element Radius Reference

| Element | Radius | Color |
|---------|--------|-------|
| H       | 0.38   | White |
| C       | 0.77   | Gray  |
| N       | 0.75   | Blue  |
| O       | 0.73   | Red   |
| S       | 1.02   | Yellow|
| P       | 1.06   | Orange|
| F       | 0.71   | Green |
| Cl      | 0.99   | Green |

## UI Elements

The widget displays several UI elements:

- **Mode Indicator** (top-right): Shows current interaction mode (EDIT/VIEW/SELECT/MEASURE)
- **View Indicator** (top-left): Shows current view mode (PERSP/ORTHO)
- **Info Panel** (bottom-left): Displays information about hovered atoms/bonds
- **Frame Indicator** (bottom): Shows current frame in multi-frame systems

All UI elements are properly layered above the canvas and remain clickable.

## Examples

### Basic Usage

```python
import molvis as mv
import molpy as mp

# Create widget
canvas = mv.Molvis(width=1200, height=900)

# Create water molecule
water = mp.Atomistic(name="water")
water.add_atom(mp.Atom(name="O", element="O", xyz=[0.0, 0.0, 0.0]))
water.add_atom(mp.Atom(name="H1", element="H", xyz=[0.76, 0.52, 0.0]))
water.add_atom(mp.Atom(name="H2", element="H", xyz=[-0.76, 0.52, 0.0]))

# Add bonds
water.add_bond(mp.Bond(water.atoms[0], water.atoms[1]))
water.add_bond(mp.Bond(water.atoms[0], water.atoms[2]))

# Visualize
frame = water.to_frame()
canvas.draw_frame(frame)
canvas
```

### Advanced Styling

```python
# Create complex molecule
molecule = create_complex_molecule()  # Your molecule creation function
frame = molecule.to_frame()

# Apply custom styling
canvas.draw_frame(
    frame=frame,
    style="ball_and_stick",
    atom_radius=1.2,    # 20% larger than default element sizes
    bond_radius=0.15,
    show_box=True
).set_camera([10, 10, 10], [0, 0, 0])
```

### Interactive Controls

```python
# Switch between different styles
canvas.set_style("spacefill")
canvas.set_style("ball_and_stick")

# Adjust atom sizes
canvas.set_atom_radius(0.8)   # 20% smaller
canvas.set_atom_radius(1.5)   # 50% larger

# Camera controls
canvas.set_camera([5, 5, 5], [1, 1, 0])
```

## Development

### Building

```bash
# Build JavaScript assets
npm run build

# Install in development mode
pip install -e .
```

### Testing

```bash
# Run basic functionality tests
python -m pytest tests/

# Test widget functionality
python example/test_clean_code.py
```

## Recent Fixes

### UI Layer Visibility (Fixed)
- **Problem**: Mode indicator and other UI elements were being covered by the canvas
- **Solution**: Added proper z-index management and pointer event handling
- **Result**: UI elements are now properly layered and remain clickable

### Atom Size Scaling (Fixed)
- **Problem**: `atom_radius` parameter was overriding element-specific sizes
- **Solution**: Changed `atom_radius` to be a scaling factor instead of absolute radius
- **Result**: Atoms now maintain their element-specific relative sizes while supporting global scaling

### JSON Serialization (Fixed)
- **Problem**: Numpy arrays in molpy Frame objects couldn't be serialized
- **Solution**: Added custom `NumpyEncoder` for JSON serialization
- **Result**: All molpy data structures can now be properly visualized

## License

This project is part of the Molcrafts ecosystem.
