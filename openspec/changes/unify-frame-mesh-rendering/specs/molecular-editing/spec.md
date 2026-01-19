## ADDED Requirements

### Requirement: Frame as Single Source of Truth
The Frame SHALL be the single source of truth for all molecular data in both View and Edit modes.

#### Scenario: Load Frame in View mode
- **GIVEN** the user has a Frame with molecular data
- **WHEN** the user loads the Frame in View mode
- **THEN** thin instances are rendered from the Frame data via DrawFrameCommand

#### Scenario: Frame persists across mode switches
- **GIVEN** the user has loaded a Frame
- **WHEN** the user switches between View and Edit modes
- **THEN** the Frame remains the authoritative data source

---

### Requirement: Frame Mutation API
The Frame class SHALL provide methods to add and remove atoms and bonds at runtime.

#### Scenario: Add atom to Frame
- **GIVEN** a Frame instance
- **WHEN** `frame.addAtom(x, y, z, element)` is called
- **THEN** a new atom is added to the Frame's atomBlock and an atom ID is returned

#### Scenario: Remove atom from Frame
- **GIVEN** a Frame with atoms
- **WHEN** `frame.removeAtom(atomId)` is called
- **THEN** the atom is removed from the Frame's atomBlock

#### Scenario: Add bond to Frame
- **GIVEN** a Frame with at least two atoms
- **WHEN** `frame.addBond(atomId1, atomId2, order)` is called
- **THEN** a new bond is added to the Frame's bondBlock

#### Scenario: Remove bond from Frame
- **GIVEN** a Frame with bonds
- **WHEN** `frame.removeBond(bondId)` is called
- **THEN** the bond is removed from the Frame's bondBlock

---

### Requirement: Scene to Frame Synchronization
Users MUST be able to save Edit mode changes by synchronizing scene data back to the Frame.

#### Scenario: Save Edit mode changes with Ctrl+S
- **GIVEN** the user is in Edit mode and has drawn atoms and bonds
- **WHEN** the user presses Ctrl+S
- **THEN** all scene data (meshes and thin instances) is collected and synchronized to the Frame

#### Scenario: Collect mesh atoms
- **GIVEN** the scene contains atom meshes created in Edit mode
- **WHEN** synchronization is triggered
- **THEN** mesh positions and elements are extracted and added to the Frame

#### Scenario: Collect thin instance atoms
- **GIVEN** the scene contains thin instance atoms from loaded Frame
- **WHEN** synchronization is triggered
- **THEN** thin instance positions and elements are extracted from transformation matrices and added to the Frame

#### Scenario: Collect bonds
- **GIVEN** the scene contains bond meshes
- **WHEN** synchronization is triggered
- **THEN** bond endpoints and orders are extracted and added to the Frame

#### Scenario: Frame is saveable after sync
- **GIVEN** the user has synchronized scene data to Frame
- **WHEN** the user attempts to save the Frame to disk
- **THEN** the Frame contains all current molecular data and can be persisted

---

### Requirement: Thin Instance to Mesh Conversion
When a user begins editing a thin instance atom, the system SHALL convert that specific instance to an editable mesh.

#### Scenario: Convert thin instance on delete
- **GIVEN** the user is in Edit mode with thin instance atoms visible
- **WHEN** the user right-clicks to delete a thin instance atom
- **THEN** the thin instance is converted to a mesh and then deleted

#### Scenario: Convert thin instance on drag
- **GIVEN** the user is in Edit mode with thin instance atoms visible
- **WHEN** the user begins dragging a thin instance atom
- **THEN** the thin instance is converted to a mesh and becomes draggable

#### Scenario: Preserve atom metadata during conversion
- **GIVEN** a thin instance atom with element, position, and other metadata
- **WHEN** the thin instance is converted to a mesh
- **THEN** all metadata (element, position, name) is preserved in the mesh

#### Scenario: Remove thin instance after conversion
- **GIVEN** a thin instance atom is being converted to a mesh
- **WHEN** the conversion completes
- **THEN** the original thin instance is removed from the scene and the mesh is registered with SceneIndex

---

### Requirement: Mixed Rendering in Edit Mode
Edit mode SHALL support simultaneous rendering of thin instances (from loaded Frame) and individual meshes (newly drawn).

#### Scenario: View loaded atoms as thin instances
- **GIVEN** the user has loaded a Frame and switched to Edit mode
- **WHEN** viewing the scene
- **THEN** atoms from the Frame are rendered as thin instances

#### Scenario: Draw new atoms as meshes
- **GIVEN** the user is in Edit mode
- **WHEN** the user draws a new atom
- **THEN** the new atom is rendered as an individual mesh via Artist

#### Scenario: Both representations coexist
- **GIVEN** the scene contains both thin instances and meshes
- **WHEN** viewing the scene
- **THEN** both thin instances and meshes are visible and pickable

---

### Requirement: Clear Scene Before Rendering
DrawFrameCommand SHALL clear existing atom and bond meshes before rendering to prevent duplicates.

#### Scenario: Clear previous atoms and bonds
- **GIVEN** the scene contains existing atom and bond meshes or thin instances
- **WHEN** DrawFrameCommand is executed
- **THEN** all existing atom and bond meshes are disposed before new thin instances are created

#### Scenario: Preserve simulation box
- **GIVEN** the scene contains a simulation box
- **WHEN** DrawFrameCommand is executed
- **THEN** the simulation box is cleared and redrawn if present in the Frame
