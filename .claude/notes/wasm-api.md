# WASM API Reference (@molcrafts/molrs)

Frame and Box come from WASM.

## Frame data access

```typescript
const block = frame.getBlock("atoms");  // column-based data
block.nrows();
block.copyColStr("element");

// Block columns (typed). All floating columns are Float64Array.
block.setColF("x", new Float64Array([...]));
block.setColU32("i", new Uint32Array([...]));
block.setColI32("type_id", new Int32Array([...]));
block.setColStr("element", ["C", "O", "H"]);
const x = block.viewColF("x");       // Float64Array — wasm-memory view
const xOwned = block.copyColF("x");  // Float64Array — owned copy
```

## Box

```typescript
const box = frame.simbox;            // Box | undefined

// Creation (all numeric inputs are Float64Array)
Box.cube(size, origin, pbc_x, pbc_y, pbc_z);
Box.ortho(lengths, origin, pbc_x, pbc_y, pbc_z);
new Box(h_matrix, origin, pbc_x, pbc_y, pbc_z);

// WASM memory: manually free Box / Grid / Frame objects you own
box.free();
```

## Volumetric grids

Grids live on `Frame` as named blocks:
```typescript
frame.getBlock("grid")                // grid data as a Block
frame.getBlock("grid")?.shape()       // [nx, ny, nz]
```

Geometry comes from `frame.simbox`; the grid block holds the scalar field
arrays.
