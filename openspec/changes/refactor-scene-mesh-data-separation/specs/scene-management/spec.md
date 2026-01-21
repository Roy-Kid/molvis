## ADDED Requirements

### Requirement: Mesh Lifecycle Management
The system SHALL provide a dedicated registry for mesh lifecycle management independent of data storage.

#### Scenario: Register mesh for picking
- **WHEN** a mesh is created via DrawFrameCommand or Artist
- **THEN** the mesh is registered in MeshRegistry with its type (atom/bond/box)
- **AND** the mesh can be retrieved by uniqueId
- **AND** no business data is stored in the registry

#### Scenario: Unregister mesh on disposal
- **WHEN** a mesh is disposed
- **THEN** MeshRegistry.unregister() removes the mesh reference
- **AND** no complex cleanup logic is required
- **AND** data in EntityRegistry is unaffected

#### Scenario: Clear all meshes
- **WHEN** mode switching or frame reload occurs
- **THEN** MeshRegistry.clear() removes all mesh references
- **AND** meshes can be disposed without data concerns

### Requirement: Scene Data Storage
The system SHALL provide a dedicated store for mesh metadata with 1:1 correspondence to MeshRegistry.

#### Scenario: Store thin instance data
- **WHEN** thin instance meshes are created in view mode
- **THEN** matrices, color buffers, and Frame references are stored in EntityRegistry
- **AND** data is keyed by mesh uniqueId (same key as MeshRegistry)
- **AND** data can be retrieved without mesh reference

#### Scenario: Store edit mesh data
- **WHEN** independent meshes are created in edit mode
- **THEN** atom/bond properties are stored in EntityRegistry
- **AND** data is keyed by mesh uniqueId (corresponding to MeshRegistry entry)
- **AND** data persists until explicitly cleared

#### Scenario: Store frame-level data
- **WHEN** a Frame is loaded
- **THEN** Frame blocks and box are stored in EntityRegistry
- **AND** frame data is accessible for queries
- **AND** frame data is independent of individual mesh data

### Requirement: Data Lifecycle Independence
The system SHALL allow metadata to outlive meshes and vice versa while maintaining 1:1 correspondence when both exist.

#### Scenario: Data survives mesh disposal
- **WHEN** a mesh is disposed but EntityRegistry is not cleared
- **THEN** the metadata remains queryable by meshId
- **AND** the metadata can be associated with a new mesh with same uniqueId
- **AND** no dangling references cause errors

#### Scenario: Mesh disposal without data cleanup
- **WHEN** a mesh is unregistered and disposed
- **THEN** only MeshRegistry.unregister() is called
- **AND** no EntityRegistry cleanup is required
- **AND** mesh disposal is a simple operation

#### Scenario: Clear data independently
- **WHEN** EntityRegistry.clear() is called
- **THEN** all stored metadata is removed
- **AND** registered meshes are unaffected
- **AND** meshes can continue to be picked and rendered

### Requirement: Generic Query Interfaces
The system SHALL provide metadata query interfaces without coupling to specific business logic.

#### Scenario: Query thin instance data
- **WHEN** a consumer needs thin instance metadata for a meshId
- **THEN** EntityRegistry.getThinInstanceData(meshId) returns the data or null
- **AND** the consumer interprets the data (EntityRegistry doesn't know the use case)
- **AND** the interface doesn't assume selection, highlighting, or info panel

#### Scenario: Query edit mesh data
- **WHEN** a consumer needs edit mesh metadata for a meshId
- **THEN** EntityRegistry.getEditMeshData(meshId) returns the data or null
- **AND** the consumer interprets the data
- **AND** the interface is generic and reusable

#### Scenario: Query frame data
- **WHEN** a consumer needs frame-level data
- **THEN** EntityRegistry.getFrameData() returns the current frame data or null
- **AND** the consumer uses the data as needed
- **AND** no business logic is embedded in the query

### Requirement: Minimal Mesh Metadata
The system SHALL minimize data stored on Babylon mesh objects.

#### Scenario: Mesh metadata contains only type
- **WHEN** a mesh is created
- **THEN** mesh.metadata contains only { meshType: 'atom' | 'bond' | 'box' }
- **AND** all other data is stored in EntityRegistry (keyed by mesh.uniqueId)
- **AND** mesh disposal doesn't require metadata cleanup

#### Scenario: Third-party metadata compatibility
- **WHEN** third-party tools add metadata to meshes
- **THEN** MolVis data in EntityRegistry is unaffected
- **AND** mesh.metadata can coexist with MolVis architecture
- **AND** MolVis only controls its own data storage

## MODIFIED Requirements

None - this is a new capability being added to the system.

## REMOVED Requirements

None - this refactoring replaces internal implementation without removing features.
