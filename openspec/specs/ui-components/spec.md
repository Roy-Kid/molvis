# ui-components Specification

## Purpose
TBD - created by archiving change pipeline-ui-redesign. Update Purpose after archive.
## Requirements
### Requirement: PipelinePanel
The main container for the modifier workflow. The system MUST render a PipelinePanel.
#### Scenario: Mounting
  - GIVEN the application is in "View" or "Edit" mode
  - WHEN the right sidebar is visible
  - THEN the `PipelinePanel` should be displayed, occupying the full height of the sidebar.

### Requirement: PipelineStack
The list of active modifiers. The system MUST display all active modifiers in a stack.
#### Scenario: Displaying Modifiers
  - GIVEN a pipeline with "Wrap PBC" and "Color Coding" modifiers
  - WHEN the `PipelineStack` renders
  - THEN it should show two rows in correct order (Top -> Bottom).
  - AND the first row (Top) should represent the Data Source.

#### Scenario: Reordering
  - GIVEN a pipeline with Modifier A followed by Modifier B
  - WHEN the user drags Modifier B above Modifier A
  - THEN the pipeline execution order should update to B -> A.
  - AND the visual list should reflect this new order immediately.

### Requirement: PropertyEditor
The details view for a specific modifier. The system MUST provide an editor for the selected modifier.
#### Scenario: Selection
  - GIVEN the "Draw Box" modifier is in the stack
  - WHEN the user clicks the "Draw Box" row
  - THEN the `PropertyEditor` should clear previous content.
  - AND render the specific controls for "Draw Box" (e.g., Color Picker, Width Slider).

### Requirement: InfoPanel Thin Instance Coordinate Display
The InfoPanel MUST display accurate 3D coordinates for individual atoms and bonds when rendered using Babylon.js thin instances.

#### Scenario: Hovering over thin instance atom
- **GIVEN** a molecule is rendered using thin instances in View mode
- **WHEN** the user hovers over an atom
- **THEN** the InfoPanel SHALL display the atom's element type and 3D coordinates (x, y, z)
- **AND** the coordinates SHALL be extracted from the thin instance transformation matrix
- **AND** the displayed coordinates SHALL match the atom's actual position in 3D space

#### Scenario: Hovering over thin instance bond
- **GIVEN** a molecule is rendered using thin instances in View mode
- **WHEN** the user hovers over a bond
- **THEN** the InfoPanel SHALL display the bond's atom indices (i, j)
- **AND** the InfoPanel SHALL display the 3D coordinates of both bond endpoints
- **AND** the InfoPanel SHALL display the bond length in Angstroms
- **AND** if available, the InfoPanel SHALL display the bond order (single, double, triple)

#### Scenario: Coordinate extraction utility availability
- **GIVEN** a mesh with thin instance data
- **WHEN** a developer calls `getAtomPositionFromThinInstance(mesh, instanceIndex)`
- **THEN** the function SHALL return a Vector3 with the atom's position
- **AND** the function SHALL handle invalid instance indices gracefully

### Requirement: Thin Instance Metadata Enhancement
The system MUST store sufficient metadata in thin instance meshes to enable coordinate and property lookup.

#### Scenario: Atom mesh metadata
- **GIVEN** an atom mesh is created using thin instances
- **WHEN** the mesh is stored in the scene
- **THEN** the mesh metadata SHALL include a reference to the source AtomBlock
- **AND** the metadata SHALL include the transformation matrix buffer
- **AND** the metadata SHALL include the atom count

#### Scenario: Bond mesh metadata
- **GIVEN** a bond mesh is created using thin instances
- **WHEN** the mesh is stored in the scene
- **THEN** the mesh metadata SHALL include a reference to the source BondBlock
- **AND** the metadata SHALL include a reference to the source AtomBlock (for endpoint coordinates)
- **AND** the metadata SHALL include the transformation matrix buffer
- **AND** the metadata SHALL include arrays of atom indices (i, j) for each bond instance

### Requirement: Context Menu Web Component
The system MUST provide a `MolvisContextMenu` web component that displays context menus at specified screen coordinates.

#### Scenario: Showing context menu
- **GIVEN** a mode-specific context menu controller has menu items to display
- **WHEN** the controller calls `menu.show(x, y, items)`
- **THEN** the context menu SHALL appear at screen coordinates (x, y)
- **AND** the menu SHALL render all provided menu items in order
- **AND** the menu SHALL be positioned to stay within viewport bounds

#### Scenario: Hiding context menu
- **GIVEN** a context menu is currently visible
- **WHEN** the user clicks outside the menu or presses Escape
- **THEN** the menu SHALL hide
- **AND** any registered close callbacks SHALL be invoked

#### Scenario: Menu item interaction
- **GIVEN** a context menu with button items
- **WHEN** the user clicks a button item
- **THEN** the button's action callback SHALL execute
- **AND** the menu SHALL remain open unless explicitly closed

### Requirement: Button Menu Item Component
The system MUST provide a `molvis-button` web component for clickable menu items.

#### Scenario: Rendering button
- **GIVEN** a MenuItem with type "button" and title "Snapshot"
- **WHEN** the button component renders
- **THEN** it SHALL display the title text
- **AND** it SHALL have hover styling
- **AND** clicking it SHALL invoke the action callback
- **AND** the click loop SHALL NOT propagate to the canvas

### Requirement: Separator Menu Item Component
The system MUST provide a `molvis-separator` web component for visual separation.

#### Scenario: Rendering separator
- **GIVEN** a MenuItem with type "separator"
- **WHEN** the separator component renders
- **THEN** it SHALL display a horizontal divider line
- **AND** it SHALL have appropriate spacing above and below

### Requirement: Folder Menu Item Component
The system MUST provide a `molvis-folder` web component for collapsible menu sections.

#### Scenario: Rendering folder
- **GIVEN** a MenuItem with type "folder", title "Atom", and nested items
- **WHEN** the folder component renders
- **THEN** it SHALL display the folder title
- **AND** it SHALL render all nested items below the title
- **AND** nested items SHALL be indented or visually grouped

### Requirement: Binding Menu Item Component
The system MUST provide a `molvis-slider` web component for interactive controls (dropdowns, sliders).

#### Scenario: Rendering dropdown binding
- **GIVEN** a MenuItem with type "binding" and bindingConfig with view "list"
- **WHEN** the binding component renders
- **THEN** it SHALL display a label
- **AND** it SHALL display a dropdown with all options
- **AND** the current value SHALL be selected
- **AND** changing the selection SHALL invoke the action callback with the new value
- **AND** interaction SHALL NOT propagate to the canvas

### Requirement: Web Component Registration
The system MUST register all context menu web components during application initialization.

#### Scenario: Component registration
- **GIVEN** the application is starting
- **WHEN** the app initialization completes
- **THEN** `molvis-context-menu` SHALL be registered as a custom element
- **AND** `molvis-button` SHALL be registered as a custom element
- **AND** `molvis-separator` SHALL be registered as a custom element
- **AND** `molvis-folder` SHALL be registered as a custom element
- **AND** `molvis-slider` SHALL be registered as a custom element
- **AND** all components SHALL be usable via `document.createElement()`

### Requirement: Click Isolation
Interactive menu components MUST consume pointer events to prevent propagation to the underlying canvas.

#### Scenario: Button Click
- **GIVEN** an open context menu over the 3D canvas
- **WHEN** the user clicks a menu button
- **THEN** the button action SHALL execute
- **AND** the click event SHALL NOT propagate to the canvas
- **AND** the canvas selection/manipulation SHALL NOT change

#### Scenario: Slider Interaction
- **GIVEN** an open context menu
- **WHEN** the user interacts with a slider or dropdown
- **THEN** the interaction events SHALL NOT propagate to the canvas

### Requirement: Idempotent Rendering
Web components MUST handle multiple render calls gracefully without duplicating content.

#### Scenario: Re-rendering
- **GIVEN** a `MolvisFolder` component
- **WHEN** `render()` is called multiple times (e.g., via data setter and connection)
- **THEN** the content SHALL only be rendered once
- **AND** no duplicate elements SHALL appear in the Shadow DOM

