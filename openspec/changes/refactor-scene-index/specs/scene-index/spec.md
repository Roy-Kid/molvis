# Capability: Scene Index

Pure index service mapping render objects to business metadata.

## ADDED Requirements

### Requirement: Chemistry-Semantic Registration APIs

The system SHALL provide registration APIs that mirror draw command semantics:
- `registerFrame(options: RegisterFrameOptions): void` — for View mode thin instances
- `registerAtom(options: RegisterAtomOptions): void` — for Edit mode individual atom
- `registerBond(options: RegisterBondOptions): void` — for Edit mode individual bond
- `registerBox(options: RegisterBoxOptions): void` — for simulation box

Each registration MUST complete in a single call—developers SHALL NOT need to call separate `register` + `setMeta` methods.

#### Scenario: Register frame with thin instance atoms and bonds

- **WHEN** developer calls `registerFrame({ atomMesh, bondMesh, atomBlock, bondBlock })`
- **THEN** SceneIndex stores the frame registration
- **AND** subsequent `getMeta(atomMesh.uniqueId, thinIndex)` returns computed `AtomMeta` from atomBlock
- **AND** subsequent `getMeta(bondMesh.uniqueId, thinIndex)` returns computed `BondMeta` from bondBlock

#### Scenario: Register independent atom in edit mode

- **WHEN** developer calls `registerAtom({ mesh, meta: { element, position, atomId } })`
- **THEN** SceneIndex stores the atom registration
- **AND** subsequent `getMeta(mesh.uniqueId)` returns the stored `AtomMeta`

#### Scenario: Register independent bond in edit mode

- **WHEN** developer calls `registerBond({ mesh, meta: { atomId1, atomId2, order } })`
- **THEN** SceneIndex stores the bond registration
- **AND** subsequent `getMeta(mesh.uniqueId)` returns the stored `BondMeta`

---

### Requirement: Metadata Query Interface

The system SHALL provide a unified query interface:
- `getMeta(meshId: number, subIndex?: number): EntityMeta | null`
- `getType(meshId: number): EntityType | null`

SceneIndex SHALL NOT expose internal storage structures to callers.

#### Scenario: Query thin instance atom from frame

- **WHEN** picker obtains `(meshId, thinInstanceIndex)` from Babylon pick result
- **AND** meshId belongs to a registered frame's atomMesh
- **AND** picker calls `getMeta(meshId, thinInstanceIndex)`
- **THEN** SceneIndex computes and returns `AtomMeta` from the frame's atomBlock

#### Scenario: Query unregistered mesh

- **WHEN** caller calls `getMeta(unknownMeshId)`
- **THEN** SceneIndex returns `null`

#### Scenario: Query thin instance mesh without subIndex

- **WHEN** caller calls `getMeta(frameMeshId)` without subIndex
- **THEN** SceneIndex returns `null` (subIndex required for thin instance lookup)

---

### Requirement: Lifecycle Management

The system SHALL provide lifecycle methods:
- `unregister(meshId: number): void` — remove all data for a mesh
- `clear(): void` — reset entire index

#### Scenario: Unregister mesh

- **WHEN** caller calls `unregister(meshId)`
- **THEN** subsequent `getMeta(meshId)` returns `null`

#### Scenario: Clear all registrations

- **WHEN** caller calls `clear()`
- **THEN** all previous registrations are removed

---

### Requirement: Separation from Picking

SceneIndex SHALL NOT contain any picking-related logic:
- SHALL NOT reference `PickResult` or `PickingInfo` types
- SHALL NOT process pointer events
- SHALL NOT compute or decode selection IDs
- SHALL NOT expose bit-encoding utilities

#### Scenario: Picking flow uses external picker

- **WHEN** user clicks on a mesh in the viewport
- **THEN** an external Picker module obtains `(mesh, thinInstanceIndex?)` from Babylon
- **AND** Picker calls `sceneIndex.getMeta(mesh.uniqueId, thinInstanceIndex)`
- **AND** SceneIndex only performs index lookup, not picking

---

### Requirement: Babylon Type Decoupling

SceneIndex public API SHALL accept `meshId: number` (from `mesh.uniqueId`) rather than Babylon's `AbstractMesh` type. Registration options accept `{ uniqueId: number }` duck-typed object.

#### Scenario: Registration uses duck-typed mesh

- **WHEN** developer registers a frame
- **THEN** options accept `atomMesh: { uniqueId: number }` (not Babylon's `Mesh`)
- **AND** SceneIndex stores data keyed by the numeric `uniqueId`

---

### Requirement: Extensibility for New Entity Types

The system SHALL support adding new entity types (angles, dihedrals, selection regions) without breaking existing APIs.

#### Scenario: Add angle registration

- **WHEN** a new `registerAngle(options)` method is added
- **THEN** existing `registerFrame`, `registerAtom`, `registerBond` continue unchanged
- **AND** `getMeta()` returns appropriate meta type for angles
