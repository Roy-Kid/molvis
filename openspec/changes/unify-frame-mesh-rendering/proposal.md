# Change: Unify Frame-Mesh Rendering with Frame as Single Source of Truth

## Why

Currently, Molvis uses two different rendering approaches that coexist but are not unified:
1. **View mode**: Uses thin instances via `DrawFrameCommand` for efficient rendering of large molecular structures from Frame data
2. **Edit mode**: Uses individual meshes via `Artist` for interactive editing (drawing atoms/bonds)

This dual approach creates several problems:
- **Data inconsistency**: When users draw molecules in Edit mode, the data exists only as meshes in the scene, not in the Frame
- **No persistence**: Ctrl+S save operation cannot persist Edit mode changes because there's no Frame to save
- **Complex mode switching**: Switching between View and Edit modes requires managing two different representations
- **Editing limitations**: Users cannot edit thin instance atoms (delete, drag, modify) without converting them to meshes first

The fundamental issue is that **Frame is not yet the single source of truth** for molecular data.

## What Changes

This change establishes Frame as the **single source of truth** for all molecular data and defines clear state transitions:

1. **Loading (View Mode)**: User loads Frame → thin instances rendered via `DrawFrameCommand`
2. **Mode Transition (View → Edit)**: Scene contains both thin instances (from loaded Frame) and meshes (newly drawn)
3. **Save Operation (Ctrl+S)**: All scene data (thin instances + meshes) → synchronized to Frame
4. **Edit Conversion**: When user edits a thin instance atom (delete/drag/modify) → convert that specific instance to mesh (delete thin instance, read from Frame, redraw as mesh)

### State Machine

The system operates in distinct states with clear transitions:

```
┌─────────────┐
│   Initial   │
└──────┬──────┘
       │ load Frame
       ▼
┌─────────────┐
│  View Mode  │◄──────────────┐
│ (Thin Inst) │               │
└──────┬──────┘               │
       │ switch to Edit       │ switch to View
       ▼                      │
┌─────────────┐               │
│  Edit Mode  │               │
│ (Mixed)     │───────────────┘
└──────┬──────┘
       │ Ctrl+S
       ▼
┌─────────────┐
│ Frame Sync  │
│ (Persist)   │
└─────────────┘
```

### Data Flow

```
Frame (Source of Truth)
  │
  ├─→ View Mode: DrawFrameCommand → Thin Instances
  │
  ├─→ Edit Mode: Artist → Meshes (new atoms/bonds)
  │
  └─→ Ctrl+S: Scene → Frame Update
       │
       ├─ Collect thin instance data
       ├─ Collect mesh data  
       └─ Merge → Update Frame
```

### Key Changes

- **Add Frame synchronization**: Implement `syncSceneToFrame()` to collect all atoms/bonds from scene (both thin instances and meshes) and update Frame
- **Add thin instance to mesh conversion**: When user begins editing a thin instance, convert it to an editable mesh
- **Modify DrawFrameCommand**: Clear existing meshes/thin instances before rendering to avoid duplicates
- **Add save handler**: Ctrl+S in Edit mode triggers Frame synchronization
- **Update Frame structure**: Ensure Frame can be mutated (add/remove atoms/bonds)

## Impact

### Affected Specs
- `molecular-editing`: Add requirements for Frame synchronization, thin instance conversion, and save operations

### Affected Code
- `core/src/core/system/frame.ts`: Frame mutation methods (addAtom, removeAtom, addBond, removeBond, clear)
- `core/src/core/system.ts`: **NEW** - System class to manage Frame and data operations
- `core/src/core/scene_sync.ts`: **NEW** - Frame synchronization utilities
- `core/src/core/thin_instance.ts`: Add thin instance to mesh conversion functions
- `core/src/mode/edit.ts`: Add Ctrl+S handler, access Frame via System
- `core/src/core/app.ts`: Add System instance, remove direct Frame management
- `core/src/commands/draw.ts`: DrawFrameCommand (already clears scene, may need refinement)

### Architecture Changes
- **System Class**: New class parallel to World for data/structure management
- **Frame Location**: Move `structure/` folder to `core/system/` 
- **Frame Access**: All Frame access through `app.system.frame` instead of `app.frame`
- **Logging**: Use tslog library (`logger.info/warn/error`) instead of console
- **Error Handling**: No try-catch blocks, let errors propagate
- **Imports**: Static imports only, no dynamic `require()`

### Breaking Changes
None - this is additive functionality that enhances existing behavior.

## Dependencies
- Requires existing `DrawFrameCommand`, `Artist`, and `Frame` classes
- Builds on existing SceneIndex for mesh/thin instance tracking
