## 1. Implementation

### Phase 1: Create Core Modules
- [x] 1.1 Implement `MeshRegistry` class with register/unregister/getMesh/getType/clear APIs
- [x] 1.2 Implement `EntityRegistry` class with set/get APIs for thin instance and edit mesh data (1:1 with MeshRegistry)
- [x] 1.3 Define data type interfaces (`ThinInstanceData`, `EditMeshData`, `FrameData`)
- [x] 1.4 Add MeshRegistry and EntityRegistry to World (alongside existing SceneIndex)

### Phase 2: Update Commands
- [x] 2.1 Update `DrawFrameCommand` to populate both SceneIndex (compatibility) and new stores
- [x] 2.2 Update `DrawAtomCommand` to populate both stores
- [x] 2.3 Update `DrawBondCommand` to populate both stores
- [x] 2.4 Ensure mesh.metadata only contains meshType

### Phase 3: Migrate Utilities
- [/] 3.1 Update `thin_instance.ts` utilities to query EntityRegistry (5 getMetadata calls remaining, needs Block API fixes)
- [x] 3.2 Update `scene_sync.ts` to query EntityRegistry for Frame synchronization
- [x] 3.3 Update `highlighter.ts` to use getThinInstanceData
- [ ] 3.4 Migrate remaining files: selection.ts (15+), mode files (10+)
- [ ] 3.5 Verify all consumers work with new architecture

### Phase 4: Remove SceneIndex (Breaking)
- [ ] 4.1 Delete SceneIndex class
- [ ] 4.2 Remove SceneIndex from World
- [ ] 4.3 Update all remaining references to use MeshRegistry + EntityRegistry
- [ ] 4.4 Remove compatibility layer

### Phase 5: Cleanup
- [ ] 5.1 Add unit tests for MeshRegistry lifecycle operations
- [ ] 5.2 Add unit tests for EntityRegistry set/get operations (verify 1:1 correspondence)
- [ ] 5.3 Add integration tests for data surviving mesh disposal
- [ ] 5.4 Update documentation with architecture diagrams

## 2. Validation
- [ ] 2.1 Verify mesh disposal doesn't require complex cleanup
- [ ] 2.2 Verify data can be queried after mesh disposal (before clear)
- [ ] 2.3 Verify view mode rendering works correctly
- [ ] 2.4 Verify edit mode rendering works correctly
- [ ] 2.5 Verify mode switching clears both mesh and data stores
- [ ] 2.6 Performance test: no regression with 10k+ atoms
- [ ] 2.7 Run `openspec validate refactor-scene-mesh-data-separation --strict --no-interactive`
