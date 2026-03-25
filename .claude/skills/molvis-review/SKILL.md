---
name: molvis-review
description: Comprehensive code review aggregating architecture, performance, documentation, and rendering safety checks. Use after writing code or during PR review.
argument-hint: "[path or module]"
user-invocable: true
---

Review code for: $ARGUMENTS

If no path given, review all files modified in `git diff --name-only HEAD`.

**Invoke all dimensions in parallel:**

1. **Architecture** → invoke `/molvis-arch` on $ARGUMENTS
2. **Performance** → invoke `/molvis-perf` on $ARGUMENTS
3. **Documentation** → invoke `/molvis-doc` on $ARGUMENTS
4. **Rendering Safety**:
   - Command do/undo symmetry: every `do()` has matching `undo()`
   - WASM memory: Box objects freed, no use-after-free
   - DrawFrameCommand vs UpdateFrameCommand: never mix concepts
   - UpdateFrameCommand must never call sceneIndex.registerFrame()
   - ImpostorState segments: frame data [0..frameOffset) vs edit data [frameOffset..count)
   - Event cleanup: all listeners removed on dispose
   - Modifier purity: apply() returns new Frame, no side effects
   - Edit mode staging: promoteFrameToEditPool → edit → syncSceneToFrame
5. **Code Quality** (inline):
   - Functions < 50 lines, files < 800 lines
   - No deep nesting (> 4 levels)
   - No hardcoded magic numbers
   - Type annotations on all public APIs
   - TSDoc/JSDoc documentation
   - Biome formatting compliance
6. **Immutability** (inline):
   - Frame data not mutated in place
   - Modifier pipeline returns new objects
   - React state updates via new references

**Severity levels**:
- CRITICAL — must fix (command symmetry, WASM safety, architecture violations)
- HIGH — should fix (missing tests, performance issues)
- MEDIUM — fix when possible (style, documentation gaps)
- LOW — nice to have

**Output**: Merged report:
```
CODE REVIEW: <path>
ARCHITECTURE: ✅/❌ per check
PERFORMANCE: ✅/⚠️ per check
DOCUMENTATION: ✅/⚠️ per check
RENDERING SAFETY: ✅/❌ per check
CODE QUALITY: ✅/⚠️ per check
IMMUTABILITY: ✅/❌ per check
SUMMARY: N CRITICAL, N HIGH, N MEDIUM, N LOW
```
