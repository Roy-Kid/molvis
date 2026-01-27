## ADDED Requirements
### Requirement: Mesh and Entity Registries
SceneIndex SHALL maintain a MeshRegistry of BabylonJS Mesh instances and an EntityRegistry of metadata entries, with a one-to-one mapping keyed by mesh uniqueId. All registry mutations MUST occur through SceneIndex APIs.

#### Scenario: Registering a mesh with metadata
- **WHEN** a mesh is registered with entity metadata
- **THEN** MeshRegistry stores the mesh and EntityRegistry stores the metadata under the same mesh ID

### Requirement: Entity Saved State Flag
EntityRegistry entries MUST include an `isSaved` flag indicating whether that entity's state has been persisted to the current Frame.

#### Scenario: Mark unsaved on modification
- **GIVEN** an entity exists in EntityRegistry
- **WHEN** it is created, moved, deleted, or its element/bond order changes
- **THEN** the affected entity entries are marked with `isSaved = false`

### Requirement: Save Marks All Entities Saved
After a successful save-to-Frame operation, SceneIndex SHALL mark all EntityRegistry entries as saved.

#### Scenario: Save after edits
- **GIVEN** at least one entity is unsaved
- **WHEN** the scene is synchronized to a Frame
- **THEN** all EntityRegistry entries are marked with `isSaved = true`

### Requirement: Saved-State Query Interface
SceneIndex SHALL provide APIs to query saved state for a mesh ID and to determine whether any entities are unsaved.

#### Scenario: Query unsaved state
- **WHEN** a caller asks SceneIndex whether any entities are unsaved
- **THEN** SceneIndex returns true if any EntityRegistry entry has `isSaved = false`
