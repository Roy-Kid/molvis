# Spec: Core Review Remediation

Status: code-complete — round 1 (9 fixes) + round 2 (deferred-items pass). See acceptance.
Slug: core-review-remediation
Created: 2026-05-28

## Round 2 outcomes (deferred-items pass)

Empirically resolved the molrs ownership question with a real-WASM rstest probe
(see memory `project_molrs_handle_ownership`). Key finding: **freeing a
getBlock/simbox handle corrupts the frame's shared data** (proved by an RDF
regression — garbage denormals), so those "leak fixes" are NOT safely doable in
JS; only WasmArray results and owned Frame objects are freeable. Reverted the
handle frees.

**Landed (round 2):**
- copyColStr element-column cache in `AtomSource` (getMeta hot path) + 3 tests.
- GPU per-buffer dirty tracking (`ImpostorState` dirty-set; position fast path
  uploads only matrix+data, not color/picking) + 5 tests.
- `SelectionReconciler` extracted from `MolvisApp` (testable) + 5 tests.
- rstest bench harness (`npm run bench`, `core/bench/*.bench.ts`) for the
  optimized hot paths.
- `@command` execution-model contract documented (fire-and-forget vs
  CommandManager) — making registry commands undoable is a regression, not a fix.

**Blocked-with-evidence (not safely completable now):**
- getBlock/simbox handle frees — corrupt shared data (RDF regression).
- C7 identity index-maps — consumers (promote/bond-selection) have zero test
  coverage; needs `ImpostorState` Mesh→uniqueId (F6) to be unit-testable first.
- A2 full (immutable swap + box preservation) — same frame/box lifecycle zone
  that caused the corruption; edit/save path has no test net.
- A3 selection authority — a design decision (GUI selections are SelectModifiers
  in the pipeline; clear-on-empty is the intended 'pipeline is authority'
  behavior), not a mechanical bug.
- Full `MolvisApp` decomposition (FrameRenderScheduler) — needs integration-test
  scaffolding for the latest-wins render queue.

## Summary

A four-axis review of `core/` (architecture, performance, WASM memory safety,
state-sync/quality) surfaced ~20 findings. This spec remediates the
**high-confidence, verifiable** subset and explicitly defers items that are
either (a) unsafe to change without molrs ownership confirmation (double-free
risk) or (b) large refactors that need a benchmark harness first to avoid
regressing the playback hot path.

## Domain basis

- `insertBlock` **deep-copies** (verified `molrs.d.ts:1167`) → modifiers that do
  `result.insertBlock(...); result.getBlock(...).setColF(...)` are **pure** w.r.t.
  the input frame. The earlier "modifiers alias/mutate input" concern is refuted.
- The `simbox` getter returns a **fresh** `Box` wrapper per call; the setter's
  copy-vs-move ownership is **undocumented** in both `.d.ts` and the `.pyi`
  binding, and no existing core code frees a `simbox`/`getBlock` handle. Freeing
  on the hot path is therefore unverified → deferred.
- `Trajectory` owns its `Frame[]`/`Box[]` and has **no** disposal path; replacing
  it in `setTrajectory` leaks every WASM frame. This is unambiguous and safe to fix.

## Design / phases

### Phase A — Correctness (verifiable by typecheck + targeted tests)
1. **Mode keyboard map** (`mode/index.ts:43-47`): `4`/`5` are swapped vs
   `app.setMode` + docs. Introduce a single `KEY_TO_MODE` map shared by keyboard
   dispatch and `app.setMode` so they cannot drift again.
2. **Edit-save immutability** (`scene_sync.ts` + `app.save()`): stop calling
   `frame.clear()` on the **live** `system.frame`; build a new Frame and swap it
   in. Preserve `simbox`; log dropped dangling bonds.
3. **Selection not clobbered by unrelated pipeline runs** (`app.ts:850`): only
   clear selection when a selection-producing modifier actually ran, not whenever
   `selectionSet.size === 0`.

### Phase B — Memory (safe subset)
4. **`Trajectory.dispose()`**: free owned frames/boxes; call on the outgoing
   trajectory in `setTrajectory`, guarding frames still aliased by
   `_sourceFrame`/`_lastRenderedFrame` and skipping lazy/provider trajectories.
5. **WasmArray leaks** (`normalize_coords.ts:106-108`): `origin()/lengths()/tilts()`
   return `WasmArray`s whose `.toCopy()` results are kept but the wrappers leak.
   Free them with the existing `copyAndFree` pattern.

### Phase C — Performance (safe, no behavior change)
6. **Bond buffer exact sizing** (`bond_buffer.ts:229`): use the existing
   `countBondInstances()` to size arrays exactly, dropping the 3× over-alloc +
   trim/copy for the common single-order case.
7. **Skip identity index maps** (`scene_index.ts:88`): when `frameInstanceMap` is
   absent (identity mapping), skip building `frameIdToIndex`/`logicalToAllIndices`.
8. **Overlay sync early-return** (`app.ts:426`): return before touching WASM when
   no atom-anchored overlays exist.
9. **Frame-diff short-circuit** (`frame_diff.ts:47`): compare element-array
   reference identity / a cheap topology fingerprint before full `copyColStr`
   compares on every seek.

### Phase D — Robustness
10. **WS binary decode bounds** (`ws_bridge.ts:34-67`): validate bufferCount,
    offsets, and `jsonEnd` against `byteLength`; wrap `handleMessage` in try/catch
    → JSON-RPC ParseError instead of killing the message loop.
11. **Expression validate/eval unify** (`expression.ts` + `ExpressionSelectionModifier`):
    validate via the same compile path used for evaluation.

## Deferred (documented, NOT changed this pass — with rationale)

- **`simbox`/`getBlock` per-frame handle frees** — double-free risk; needs a
  runtime free-twice test or a molrs API that makes ownership explicit.
- **`MolvisApp` decomposition** (FrameRenderScheduler / SelectionReconciler /
  AnchoredOverlaySync) — large, regression-prone; gate on a `vitest bench`
  harness so the playback path is measured before/after.
- **`@command` undo policy** — RPC-path commands bypass undo history; this is a
  behavior decision (transient vs reversible registry split), not a bug fix.
- **GPU per-buffer dirty tracking** (`ImpostorState.needsUpload` → dirty set) —
  highest perf win but touches the buffer-upload core; do under the bench harness.
- **`copyColStr` frame-scoped cache** (`entity_source.ts:145`) — needs cache
  invalidation tied to `setFrame`; do with the bench harness to confirm the win.

## Testing

- `npm run typecheck` clean across workspaces.
- `npm test` green; add/extend core unit tests for: KEY_TO_MODE mapping,
  `Trajectory.dispose`, bond-buffer exact sizing, frame-diff short-circuit,
  ws-bridge malformed-frame rejection.
- No E2E (per project rule — cover logic with core unit tests).

## Out of scope

- molrs (Rust/WASM) changes.
- The deferred items above.
</content>
</invoke>
