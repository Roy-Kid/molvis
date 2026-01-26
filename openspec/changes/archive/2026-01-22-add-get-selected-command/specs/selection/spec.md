## ADDED Requirements

### Requirement: Get Selected Entities Command
The system SHALL provide a `get_selected` command that returns metadata for all currently selected atoms and bonds in Select mode in a columnar format compatible with `molpy.Frame` construction.

#### Scenario: Query selected atoms
- **WHEN** user is in Select mode with one or more atoms selected
- **THEN** calling `get_selected` returns a dictionary with an `atoms` key containing columnar arrays: `atomId`, `element`, `x`, `y`, `z`

#### Scenario: Query selected bonds
- **WHEN** user is in Select mode with one or more bonds selected
- **THEN** calling `get_selected` returns a dictionary with a `bonds` key containing columnar arrays: `bondId`, `atomId1`, `atomId2`, `order`, `start_x`, `start_y`, `start_z`, `end_x`, `end_y`, `end_z`

#### Scenario: Empty selection
- **WHEN** user is in Select mode with no entities selected
- **THEN** calling `get_selected` returns a dictionary with empty arrays in `atoms` and `bonds` objects

### Requirement: Python Selection Query API
The Python `Molvis` widget SHALL provide a `get_selected()` method that queries the frontend for current selection state and returns the result as a `molpy.Frame` object.

#### Scenario: Python get_selected call
- **WHEN** Python code calls `scene.get_selected()`
- **THEN** the method blocks until a response is received from the frontend and returns a `molpy.Frame` with 'atoms' and 'bonds' blocks

#### Scenario: Python get_selected timeout
- **WHEN** Python code calls `scene.get_selected()` with a custom timeout
- **AND** the frontend does not respond within the timeout
- **THEN** a `TimeoutError` is raised

### Requirement: Internal Selection Metadata API
The `SelectionManager` TypeScript class SHALL provide a `getSelectedMeta()` method that returns structured metadata for all selected entities, suitable for use by other internal components.

#### Scenario: Internal component queries selection
- **WHEN** an internal component calls `selectionManager.getSelectedMeta()`
- **THEN** it receives an object with `atoms` and `bonds` arrays containing the metadata for all selected entities
