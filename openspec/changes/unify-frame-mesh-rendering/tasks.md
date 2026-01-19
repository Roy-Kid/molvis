# Implementation Tasks

## 1. Frame Mutation API
- [x] 1.1 Add `addAtom(x: number, y: number, z: number, element: string): number` method to Frame class
- [x] 1.2 Add `removeAtom(atomId: number): void` method to Frame class
- [x] 1.3 Add `addBond(atomId1: number, atomId2: number, order: number): void` method to Frame class
- [x] 1.4 Add `removeBond(bondId: number): void` method to Frame class
- [x] 1.5 Add `clear(): void` method to Frame class to reset all atoms and bonds
- [x] 1.6 Update AtomBlock and BondBlock to support dynamic resizing
- [ ] 1.7 Write unit tests for Frame mutation methods

## 2. Scene Synchronization Utility
- [x] 2.1 Create `core/src/core/scene_sync.ts` file
- [x] 2.2 Implement `syncSceneToFrame(scene: Scene, frame: Frame): void` function
- [x] 2.3 Add logic to collect atom data from individual meshes
- [x] 2.4 Add logic to collect atom data from thin instances (extract from transformation matrices)
- [x] 2.5 Add logic to collect bond data from meshes
- [x] 2.6 Add logic to merge collected data and update Frame
- [ ] 2.7 Write unit tests for scene synchronization

## 3. Thin Instance Conversion
- [x] 3.1 Create `convertThinInstanceToMesh(thinInstanceMesh: Mesh, instanceIndex: number, app: MolvisApp): Mesh` function
- [x] 3.2 Extract atom position from transformation matrix
- [x] 3.3 Extract atom element and metadata from thin instance metadata
- [x] 3.4 Create new mesh using Artist with extracted data
- [x] 3.5 Remove the specific thin instance from the base mesh (or mark as deleted)
- [x] 3.6 Register new mesh with SceneIndex
- [ ] 3.7 Write unit tests for conversion logic

## 4. Edit Mode Integration
- [x] 4.1 Add Ctrl+S keyboard handler in EditMode class
- [x] 4.2 Call `syncSceneToFrame()` when Ctrl+S is pressed
- [ ] 4.3 Show user feedback (toast/notification) after successful save
- [ ] 4.4 Update delete atom logic to convert thin instance to mesh before deletion
- [ ] 4.5 Update drag atom logic to convert thin instance to mesh before dragging
- [x] 4.6 Handle edge cases (empty scene, no Frame loaded)

## 5. DrawFrameCommand Refinement
- [x] 5.1 Verify that DrawFrameCommand properly clears existing meshes (already implemented)
- [x] 5.2 Ensure thin instances are cleared before re-rendering
- [ ] 5.3 Add option to preserve certain meshes if needed (future enhancement)

## 6. Documentation and Testing
- [ ] 6.1 Update README or user documentation with Ctrl+S save workflow
- [ ] 6.2 Add integration tests for full workflow (load → edit → save → reload)
- [ ] 6.3 Test with large structures (1000+ atoms) to verify performance
- [ ] 6.4 Test mode switching with mixed rendering
- [ ] 6.5 Verify no memory leaks from conversion operations

## 7. Validation
- [x] 7.1 Run `openspec validate unify-frame-mesh-rendering --strict --no-interactive`
- [ ] 7.2 Fix any validation errors
- [ ] 7.3 Request user review of proposal
