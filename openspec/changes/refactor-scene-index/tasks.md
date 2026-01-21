# Tasks: Refactor SceneIndex

## 1. Core Implementation

- [ ] 1.1 Define TypeScript interfaces: `AtomMeta`, `BondMeta`, `BoxMeta`, `EntityMeta`
- [ ] 1.2 Define registration options: `RegisterFrameOptions`, `RegisterAtomOptions`, `RegisterBondOptions`, `RegisterBoxOptions`
- [ ] 1.3 Implement `SceneIndex` class with chemistry-semantic APIs
- [ ] 1.4 Implement `registerFrame()` — stores atomMesh/bondMesh with Block references for thin instance lookup
- [ ] 1.5 Implement `registerAtom()` / `registerBond()` / `registerBox()` for edit mode / box
- [ ] 1.6 Implement `getMeta(meshId, subIndex?)` — returns computed meta from Block for frames, stored meta for edit mode
- [ ] 1.7 Implement `getType(meshId)` and lifecycle methods (`unregister`, `clear`)

## 2. Migrate Registration Sites

- [ ] 2.1 Update `DrawFrameCommand.do()` to use `registerFrame({ atomMesh, bondMesh, atomBlock, bondBlock, box })`
- [ ] 2.2 Update `DrawAtomCommand.do()` to use `registerAtom({ mesh, meta })`
- [ ] 2.3 Update `DrawBondCommand.do()` to use `registerBond({ mesh, meta })`
- [ ] 2.4 Update `DrawBoxCommand.do()` to use `registerBox({ mesh, meta })`

## 3. Migrate Query Sites

- [ ] 3.1 Update `selection_manager.ts` to use `getMeta()` instead of internal registry access
- [ ] 3.2 Update `highlighter.ts` to use `getMeta()` for render references
- [ ] 3.3 Update `selector.ts` to use new query API
- [ ] 3.4 Update `thin_instance.ts` helper functions
- [ ] 3.5 Update `scene_sync.ts` to iterate via new API

## 4. Remove Deprecated Code

- [ ] 4.1 Remove `resolvePickToId()` from SceneIndex
- [ ] 4.2 Remove `encodeSelectionId()` / `decodeSelectionId()` utilities
- [ ] 4.3 Remove `getRenderRef()` (replaced by `getMeta()`)
- [ ] 4.4 Remove old `registerMesh()` / `registerThinInstances()` APIs
- [ ] 4.5 Remove or merge `MeshRegistry` and `EntityRegistry` into new SceneIndex

## 5. Verification

- [ ] 5.1 TypeScript strict compilation passes
- [ ] 5.2 Run existing tests
- [ ] 5.3 Manual test: load molecule, verify rendering
- [ ] 5.4 Manual test: verify selection/highlighting works with new query API
