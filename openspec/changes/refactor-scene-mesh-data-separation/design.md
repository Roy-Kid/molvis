# Design: SceneIndex Mesh and Data Separation

## Context
SceneIndex currently serves two conflicting purposes:
1. **Mesh lifecycle**: Register/unregister meshes, resolve viewport picks to mesh references
2. **Data storage**: Store atom blocks, bond blocks, matrices, color buffers, topology indices

This creates problems:
- Mesh disposal requires knowing about all stored data types
- Adding new data fields requires modifying SceneIndex
- Data cannot outlive meshes (e.g., during mode switches)
- Unclear ownership: who owns the data, SceneIndex or the mesh?

## Goals / Non-Goals
- Goals:
  - Separate mesh lifecycle management from data storage
  - Make mesh disposal trivial (no complex cleanup logic)
  - Allow data to outlive meshes
  - Provide generic query interfaces without business logic coupling
- Non-Goals:
  - Change how selection, highlighting, or info panel work (they are consumers)
  - Modify Frame structure or rendering implementation
  - Introduce new features beyond architectural cleanup

## Core Principle

> **Mesh Registry knows about meshes. Data Store knows about data. Neither knows about selection, highlighting, or other business logic.**

## Decisions

### Decision 1: Split SceneIndex into MeshRegistry + EntityRegistry

**MeshRegistry** - Pure mesh lifecycle management:
```typescript
class MeshRegistry {
  private meshes = new Map<number, AbstractMesh>();
  private meshTypes = new Map<number, MeshType>();
  
  // Register a mesh for picking
  register(mesh: AbstractMesh, type: MeshType): void;
  
  // Unregister a mesh (called on disposal)
  unregister(mesh: AbstractMesh): void;
  
  // Resolve viewport pick to mesh reference
  getMesh(uniqueId: number): AbstractMesh | null;
  getType(uniqueId: number): MeshType | null;
  
  // Clear all registrations
  clear(): void;
}

type MeshType = 'atom' | 'bond' | 'box' | 'frame';
```

**EntityRegistry** - Business data storage:
```typescript
class EntityRegistry {
  // Thin instance data (view mode)
  private thinInstanceData = new Map<number, ThinInstanceData>();
  
  // Edit mode data
  private editMeshData = new Map<number, EditMeshData>();
  
  // Frame-level data
  private frameData: FrameData | null = null;
  
  // Generic setters (called by commands during mesh creation)
  setThinInstanceData(meshId: number, data: ThinInstanceData): void;
  setEditMeshData(meshId: number, data: EditMeshData): void;
  setFrameData(data: FrameData): void;
  
  // Generic getters (called by consumers)
  getThinInstanceData(meshId: number): ThinInstanceData | null;
  getEditMeshData(meshId: number): EditMeshData | null;
  getFrameData(): FrameData | null;
  
  // Cleanup
  clear(): void;
  removeMeshData(meshId: number): void;
}
```

**Why**: Single Responsibility Principle. MeshRegistry doesn't care what data you store; EntityRegistry doesn't care about mesh lifecycle.

**Alternatives considered**:
- Keep unified SceneIndex with better organization → Still mixes concerns
- Use multiple specialized stores → Over-engineered; two focused modules are enough

### Decision 2: Define data types, not business logic

```typescript
// Thin instance data (view mode)
interface ThinInstanceData {
  matrices: Float32Array;
  colorBuffer: Float32Array;
  atomBlock?: AtomBlock;  // Reference to Frame data
  bondBlock?: BondBlock;
  i?: Uint32Array;        // Bond topology
  j?: Uint32Array;
  count: number;
}

// Edit mode data
interface EditMeshData {
  atomId?: number;
  bondId?: number;
  element?: string;
  position?: Vector3;
  // ... other edit-specific fields
}

// Frame-level data
interface FrameData {
  atomBlock: AtomBlock;
  bondBlock?: BondBlock;
  box?: Box;
}
```

**Why**: These are pure data structures. EntityRegistry doesn't interpret them; it just stores and retrieves.

**Alternatives considered**:
- Store raw Frame only → Loses rendering cache (matrices, colors)
- Store everything as generic Map<string, any> → Loses type safety

### Decision 3: Minimal mesh.metadata footprint

Only store what Babylon.js or third-party tools absolutely need:
```typescript
mesh.metadata = { meshType: 'atom' };  // That's it
```

All other data goes to EntityRegistry.

**Why**: Reduces coupling, makes mesh disposal safe, clarifies ownership.

**Alternatives considered**:
- Store meshType in MeshRegistry only → Some Babylon tools expect mesh.metadata
- Keep current metadata → Defeats the purpose of this refactoring

### Decision 4: Query interfaces are generic

Consumers (selection, highlighting, info panel) query data like this:
```typescript
// Example: Info panel wants atom data
const meshId = /* from pick or selection */;
const thinIndex = /* from pick, or undefined */;

// Query thin instance data
const thinData = sceneDataStore.getThinInstanceData(meshId);
if (thinData && thinIndex !== undefined) {
  const position = getPositionFromMatrix(thinData.matrices, thinIndex);
  const element = thinData.atomBlock?.element[thinIndex];
  // Display info
}

// Query edit mode data
const editData = sceneDataStore.getEditMeshData(meshId);
if (editData) {
  const position = editData.position;
  const element = editData.element;
  // Display info
}
```

**Why**: EntityRegistry doesn't know about "selection" or "info panel". It just provides data.

**Alternatives considered**:
- Add helper methods like `getAtomInfo(meshId, thinIndex)` → Couples to specific use cases
- Keep current approach with metadata → No separation achieved

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Scene Layer                        │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────────┐      ┌───────────────────┐   │
│  │  MeshRegistry    │      │  EntityRegistry   │   │
│  ├──────────────────┤      ├───────────────────┤   │
│  │ - meshes         │      │ - thinInstanceData│   │
│  │ - meshTypes      │      │ - editMeshData    │   │
│  │                  │      │ - frameData       │   │
│  │ register()       │      │                   │   │
│  │ unregister()     │      │ setThinInstance() │   │
│  │ getMesh()        │      │ setEditMesh()     │   │
│  │ getType()        │      │ getThinInstance() │   │
│  └──────────────────┘      │ getEditMesh()     │   │
│                             └───────────────────┘   │
│                                                       │
│  No coupling between them                            │
│                                                       │
└─────────────────────────────────────────────────────┘
         ▲                            ▲
         │                            │
         │                            │
    ┌────┴────┐                  ┌────┴────┐
    │ Picking │                  │ Queries │
    │ (modes) │                  │ (info,  │
    │         │                  │  sync)  │
    └─────────┘                  └─────────┘

Consumers use both, but MeshRegistry and EntityRegistry
don't know about each other or the consumers.
```

## Data Flow Examples

### Example 1: DrawFrameCommand (View Mode)
```typescript
// 1. Create thin instance meshes
const atomMesh = createThinInstanceAtoms(frame);
const bondMesh = createThinInstanceBonds(frame);

// 2. Register meshes (lifecycle)
meshRegistry.register(atomMesh, 'atom');
meshRegistry.register(bondMesh, 'bond');

// 3. Store data (independent)
sceneDataStore.setThinInstanceData(atomMesh.uniqueId, {
  matrices: atomMatrices,
  colorBuffer: atomColors,
  atomBlock: frame.atomBlock,
  count: frame.getAtomCount()
});

sceneDataStore.setThinInstanceData(bondMesh.uniqueId, {
  matrices: bondMatrices,
  colorBuffer: bondColors,
  bondBlock: frame.bondBlock,
  atomBlock: frame.atomBlock,  // For endpoint lookup
  i: frame.bondBlock.i,
  j: frame.bondBlock.j,
  count: frame.getBondCount()
});

sceneDataStore.setFrameData({
  atomBlock: frame.atomBlock,
  bondBlock: frame.bondBlock,
  box: frame.box
});
```

### Example 2: Artist.drawAtom (Edit Mode)
```typescript
// 1. Create mesh
const mesh = MeshBuilder.CreateSphere(...);

// 2. Register mesh
meshRegistry.register(mesh, 'atom');

// 3. Store data
sceneDataStore.setEditMeshData(mesh.uniqueId, {
  atomId: generateId(),
  element: 'C',
  position: position.clone()
});
```

### Example 3: Mode Switch (View → Edit)
```typescript
// 1. Clear meshes
scene.meshes.forEach(m => {
  meshRegistry.unregister(m);
  m.dispose();
});

// 2. Clear data
sceneDataStore.clear();

// 3. Rebuild in edit mode
// ... create individual meshes and store edit data
```

Data and meshes are cleared independently. No complex cleanup logic needed.

### Example 4: Info Panel Query
```typescript
// User clicks atom
const pickResult = scene.pick(...);
const meshId = pickResult.pickedMesh.uniqueId;
const thinIndex = pickResult.thinInstanceIndex;

// Query data (EntityRegistry doesn't know this is for "info panel")
const thinData = sceneDataStore.getThinInstanceData(meshId);
if (thinData && thinIndex !== undefined) {
  const position = getPositionFromMatrix(thinData.matrices, thinIndex);
  const element = thinData.atomBlock.element[thinIndex];
  
  // Display
  infoPanel.show({ element, position });
}
```

## Migration Strategy

### Phase 1: Create new modules (non-breaking)
1. Implement `MeshRegistry` class
2. Implement `EntityRegistry` class
3. Add to World alongside existing SceneIndex
4. Update DrawFrameCommand to populate both old and new stores

### Phase 2: Migrate consumers
1. Update thin_instance.ts utilities to query EntityRegistry
2. Update scene_sync.ts to query EntityRegistry
3. Update highlighter to use MeshRegistry for mesh lookup
4. Update modes to use new APIs

### Phase 3: Remove SceneIndex (breaking)
1. Delete SceneIndex class
2. Remove all SceneIndex references
3. Update World to only expose MeshRegistry + EntityRegistry

### Phase 4: Cleanup
1. Remove mesh.metadata except meshType
2. Add tests for data/mesh lifecycle independence
3. Document new architecture

## Risks / Trade-offs

### Risk: Increased memory usage
- **Mitigation**: Data is already stored; we're just reorganizing it
- **Measurement**: Profile before/after with 10k+ atoms

### Risk: Breaking existing code
- **Mitigation**: Phased migration with compatibility layer
- **Acceptance**: This is intentional cleanup; update sites are known

### Risk: Consumers need to query two places
- **Mitigation**: Provide helper utilities if needed, but keep core modules decoupled
- **Acceptance**: Explicit is better than implicit

## Open Questions

1. Should FrameData be stored separately or as part of thinInstanceData?
   - **Current answer**: Separate, because it's frame-level, not mesh-level

2. Should we provide a unified query helper?
   - **Current answer**: No, keep core modules simple; consumers can create helpers

3. How to handle custom metadata from third-party tools?
   - **Current answer**: They can still use mesh.metadata; we only control MolVis data
