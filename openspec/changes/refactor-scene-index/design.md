# Design: SceneIndex as Pure Index Service

## Context

molvis currently uses `SceneIndex` to:
1. Register meshes and associate them with business metadata
2. Resolve viewport picks to encoded selection IDs
3. Map selection IDs back to render references for highlighting

This coupling creates problems:
- Developers must understand internal ID encoding
- Registration requires multiple calls (`register` + `setMeta`)
- SceneIndex knows about picking, which should be external

### Stakeholders
- **Renderer developers**: Need simple registration APIs
- **Picker/Selection system**: Needs metadata lookup from pick results
- **Highlighter**: Needs render references for visual feedback

## Goals / Non-Goals

### Goals
- SceneIndex is a pure key-value index: `(meshId, subIndex?) → Meta`
- **Semantic registration APIs matching draw commands**: `registerFrame`, `registerAtom`, `registerBond`, `registerBox`
- No knowledge of picking flow, events, or selection state
- No bit-encoding; keys are simple tuples
- `FrameMeta` represents thin instance data (View mode)
- `AtomMeta`/`BondMeta` for independent meshes (Edit mode)
- Extensible to new entity types (angles, dihedrals, regions, etc.)

### Non-Goals
- SceneIndex does NOT do highlighting/materials
- SceneIndex does NOT hold Selection state
- SceneIndex does NOT parse PickResult or pointer events
- No GPU picking integration in this proposal

## Decisions

### Decision 1: Key Model

**Query Key** = `(meshId: number, subIndex?: number)`

- `meshId`: Babylon's `mesh.uniqueId` (numeric, stable per mesh lifetime)
- `subIndex`: Optional thin instance index or child element index

External callers (picker) construct the key from their pick results and call `getMeta(meshId, subIndex)`.

### Decision 2: Semantic Registration APIs (Chemistry-aligned)

Registration APIs MUST match draw command semantics:

| Draw Command | Register API | Mode | Notes |
|--------------|--------------|------|-------|
| `draw_frame` | `registerFrame(options)` | View | Thin instances for atoms+bonds |
| `draw_atom` | `registerAtom(options)` | Edit | Independent atom mesh |
| `draw_bond` | `registerBond(options)` | Edit | Independent bond mesh |
| `draw_box` | `registerBox(options)` | Both | Simulation box |

```typescript
// View mode: FrameMeta represents thin instance data
interface RegisterFrameOptions {
  atomMesh: { uniqueId: number };
  bondMesh?: { uniqueId: number };
  atomBlock: Block;
  bondBlock?: Block;
  box?: Box;
}

// Edit mode: individual atom
interface RegisterAtomOptions {
  mesh: { uniqueId: number };
  meta: AtomMeta;  // element, position, atomId
}

// Edit mode: individual bond
interface RegisterBondOptions {
  mesh: { uniqueId: number };
  meta: BondMeta;  // atomId1, atomId2, order, positions
}

// Box (either mode)
interface RegisterBoxOptions {
  mesh: { uniqueId: number };
  meta: BoxMeta;  // dimensions
}
```

**Why chemistry semantics?** Developers think in terms of "frame", "atom", "bond"—not "thin instances" or "mesh types".

### Decision 3: FrameMeta for Thin Instances

When `registerFrame` is called, SceneIndex stores:
- `atomMesh.uniqueId` → `FrameAtomIndex` (thin instance lookup)
- `bondMesh.uniqueId` → `FrameBondIndex` (thin instance lookup)

Query with subIndex returns computed meta from Block:
```typescript
getMeta(atomMeshId, thinIndex) → {
  type: 'atom',
  element: atomBlock.col_strings('element')[thinIndex],
  position: { x, y, z from atomBlock },
  atomId: thinIndex
}
```

### Decision 4: Query API

```typescript
interface SceneIndex {
  getMeta(meshId: number, subIndex?: number): EntityMeta | null;
  getType(meshId: number): EntityType | null;
}

type EntityType = 'atom' | 'bond' | 'box' | 'frame';
type EntityMeta = AtomMeta | BondMeta | BoxMeta;
```

Returns `null` for:
- Unregistered mesh
- Missing subIndex for thin instance mesh
- subIndex out of bounds

### Decision 5: Lifecycle Management

```typescript
interface SceneIndex {
  unregister(meshId: number): void;
  clear(): void;
}
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Breaking change for all consumers | No backward compat code; one-shot migration |
| Computing meta from Block on each query | Cache if needed; Block access is fast |

## Migration Plan

1. Create new `SceneIndex` implementation with chemistry-semantic APIs
2. Update `DrawFrameCommand` to use `registerFrame()`
3. Update `DrawAtomCommand`/`DrawBondCommand` to use `registerAtom()`/`registerBond()`
4. Update all query consumers to use `getMeta()`
5. Move picking logic to external Picker module
6. Remove deprecated code

## Open Questions

1. Should `getMeta` for thin instances compute and cache, or compute on-demand?
   - Recommendation: Compute on-demand; Block lookup is O(1), caching adds complexity
