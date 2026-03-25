---
name: molvis-test
description: "Design test strategy and write tests for MolVis features using rstest. Covers modifier tests, command do/undo symmetry, selection tests, and edge cases. Use when adding or reviewing tests."
argument-hint: "<feature or file path to test>"
---

You are a test engineer for MolVis. Design and implement test strategies for the specified feature or code.

## Context

- **Framework**: rstest (Rust-based, similar to vitest/jest)
- **Test location**: `core/tests/`
- **Run tests**: `npm test` or `npm run test:watch`
- **No browser automation** — unit tests only, mock BabylonJS dependencies

## Testing Patterns in MolVis

### Modifier Tests (most common)
```typescript
import { describe, it, expect } from "rstest";

describe("MyModifier", () => {
  it("should transform frame correctly", () => {
    const frame = createTestFrame(/* atoms, bonds */);
    const context = createMockContext(/* selection, sceneIndex */);
    const modifier = new MyModifier(/* params */);

    const result = modifier.apply(frame, context);

    expect(result).not.toBe(frame); // immutability
    expect(result.getBlock("atoms").nrows()).toBe(expectedCount);
  });
});
```

### Command Tests
```typescript
describe("MyCommand", () => {
  it("do() and undo() are symmetric", async () => {
    const app = createMockApp();
    const cmd = new MyCommand(app, params);

    const before = captureState(app);
    await cmd.do();
    await cmd.undo();
    const after = captureState(app);

    expect(after).toEqual(before);
  });
});
```

### Selection Tests
```typescript
describe("SelectionManager", () => {
  it("selectByExpression returns correct atoms", () => {
    const manager = new SelectionManager(mockSceneIndex);
    manager.selectByExpression("element == 'C'");

    const state = manager.getState();
    expect(state.atoms.size).toBeGreaterThan(0);
  });
});
```

### Mock Patterns
- Mock `SceneIndex` with in-memory registries (no BabylonJS needed)
- Mock `MetaRegistry` with test atom/bond data
- Create test frames with known atom counts and positions
- Never mock the modifier pipeline — test modifiers individually

## Steps

1. **Analyze the feature**: Read the code to understand what needs testing
2. **Identify test categories**:
   - Unit tests for individual functions/modifiers
   - Command do/undo symmetry tests
   - Edge cases (empty frames, single atom, zero bonds)
   - Error conditions (invalid input, missing data)
3. **Write tests using TDD** (RED → GREEN → REFACTOR):
   - Write failing tests first
   - Run `npm test` to confirm they fail
   - Implement minimal code to pass
   - Refactor while keeping tests green
4. **Verify coverage**: Aim for 80%+ on new code
5. **Run final check**: `npm test` must pass cleanly

## Key Edge Cases for MolVis

- Empty frame (0 atoms, 0 bonds)
- Single atom (no bonds possible)
- Frame with box vs without box
- Trajectory with 1 frame vs many frames
- Selection on empty scene
- Mode switch during active operation
- WASM object lifecycle (creation, use, free)

## Input

Feature or code to test: $ARGUMENTS
