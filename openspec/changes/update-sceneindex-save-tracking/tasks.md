## 1. Implementation
- [ ] 1.1 Add MeshRegistry + EntityRegistry to SceneIndex and include `isSaved` on entity entries.
- [ ] 1.2 Update SceneIndex registration/unregister/getMeta APIs and all callers to pass/store BabylonJS Mesh objects.
- [ ] 1.3 Add saved-state APIs (query + mark) and wire edit operations to mark unsaved; mark all saved after `syncSceneToFrame`.
- [ ] 1.4 Add a core Frame serialization API that uses wasm `write_frame` and returns text+format without delivery side effects.

## 2. Validation
- [ ] 2.1 Manual: edit atoms/bonds and confirm entities become unsaved; save-to-frame marks all saved.
- [ ] 2.2 Manual: serialize a Frame and confirm output is returned without download/IO.
