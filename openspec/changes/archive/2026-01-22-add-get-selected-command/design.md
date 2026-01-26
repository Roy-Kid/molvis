# Design: Get Selected Command

## Context
Currently, molvis provides a `SelectMode` that allows users to click atoms/bonds to select them. The `SelectionManager` tracks selection state using `SelectionKey` (meshId:subIndex format), and `SceneIndex` provides entity metadata lookup. However, there is no way to programmatically query the current selection from Python.

## Goals
- Provide a Python-callable command to retrieve selected atoms/bonds metadata
- Provide an internal TypeScript API for other components to access selected entity metadata
- Return structured data (atom positions, elements, bond info) rather than internal IDs

## Non-Goals
- Modifying selection state from Python (separate feature)
- Persisting selection across sessions
- Complex selection expressions or queries

## Architecture

### Data Flow

```
Python          │  Widget Comm   │  TypeScript
────────────────┼────────────────┼───────────────────────
get_selected()  │  JSON-RPC      │  get_selected command
                │  ──request──>  │       ↓
                │                │  SelectionManager
                │                │  .getSelectedMeta()
                │                │       ↓
                │                │  SceneIndex.getMeta()
                │  <──response── │       ↓
dict result     │                │  { atoms: [], bonds: [] }
```

### Response Schema

```typescript
interface GetSelectedResponse {
  atoms: {
    atomId: number[];
    element: string[];
    x: number[];
    y: number[];
    z: number[];
  };
  bonds: {
    bondId: number[];
    atomId1: number[];
    atomId2: number[];
    order: number[];
    start_x: number[];
    start_y: number[];
    start_z: number[];
    end_x: number[];
    end_y: number[];
    end_z: number[];
  };
}
```

Columnar format is compatible with `molpy.Frame` construction.

### TypeScript Changes

1. **SelectionManager.getSelectedMeta()**:
   - Iterate `state.atoms` and `state.bonds` 
   - For each key, parse and lookup via `SceneIndex.getMeta()`
   - Return structured array of `AtomMeta` and `BondMeta`

2. **Register `get_selected` command**:
   - Returns `GetSelectedResponse` from `SelectionManager.getSelectedMeta()`

### Python Changes

1. **SelectionCommandsMixin**:
   - `get_selected(timeout: float = 5.0) -> mp.Frame` method
   - Uses `send_cmd("get_selected", {}, wait_for_response=True)`
   - Constructs `molpy.Frame` from columnar response data
   - Returns Frame with 'atoms' and 'bonds' blocks

## Decisions
- **Return metadata, not keys**: Python consumers want element symbols and positions, not internal meshId:subIndex keys
- **Synchronous Python API with timeout**: Use the existing `wait_for_response` pattern for simplicity
- **Separate mixin**: Following the existing `DrawingCommandsMixin` pattern

## Risks / Trade-offs
- **Performance**: For large selections, this could return significant data. Mitigation: selections are typically small (<100 atoms).
- **Stale data**: Selection state is queried on-demand; if scene changes between selection and query, metadata might be stale. Acceptable for interactive use.

## Open Questions
None at this time.
