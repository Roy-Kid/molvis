# Acceptance: core-review-remediation

last_checked: 2026-05-28

| # | Criterion | type | status |
|---|-----------|------|--------|
| A1 | Keyboard `4`→Manipulate, `5`→Measure; shared `KEY_TO_MODE`; `app.setMode` validates against `ModeType` | unit | verified |
| A2 | `syncSceneToFrame` logs dropped dangling bonds (no silent discard) | unit | verified |
| B4 | `Trajectory.dispose()` frees owned frames; `setTrajectory` disposes the outgoing trajectory, guarding aliased/lazy frames | unit | verified |
| B5 | `normalize_coords` frees the `origin`/`lengths`/`tilts` WasmArray wrappers | code-review | verified |
| C6 | Bond buffers sized exactly via `countBondInstances` (no 3× over-alloc) | unit | verified |
| C8 | `_syncAnchoredOverlays` early-returns via `OverlayManager.size` before WASM access | code-review | verified |
| C9 | `classifyFrameTransition` caches the element column per-Frame + skips bond-order scan when no order column | unit | verified |
| D10 | Malformed binary RPC frame rejected (ParseError) without killing the message loop | unit | verified |
| D11 | Expression validation uses the same `ExpressionSelector.compile` path as evaluation | code-review | verified |
| R2-1 | `AtomSource` element-column cache (getMeta no longer re-copies per pick); invalidated on `setFrame` | unit | verified |
| R2-2 | `ImpostorState` per-buffer dirty set; position fast path uploads only matrix+data | unit | verified |
| R2-3 | `SelectionReconciler` extracted from `MolvisApp`, unit-tested without a scene | unit | verified |
| R2-4 | rstest bench harness (`npm run bench`) over the optimized hot paths | code-review | verified |
| R2-5 | `@command` execution-model contract (fire-and-forget vs CommandManager) documented | code-review | verified |
| G | `npm run typecheck` clean (all workspaces); core suite green (456 tests) | gate | verified |

## Blocked — moved to `.claude/notes/open-questions.md` (proven prerequisites, not part of this remediation)

- **getBlock/simbox handle frees** — freeing corrupts shared frame data (RDF regression). Needs a molrs owned-copy API.
- **C7 identity index-maps** — consumers untested; needs `ImpostorState` Mesh→uniqueId (F6) to unit-test first.
- **A2 immutable swap + box preservation** — same frame/box lifecycle zone that caused the corruption; edit/save path untested.
- **A3 selection authority** — design decision (GUI selections are pipeline `SelectModifier`s; clear-on-empty is intended). Not a bug.
- **Full `MolvisApp` decomposition (FrameRenderScheduler)** — needs integration-test scaffolding for the latest-wins render queue.

## Out of scope / external

- `page` test `test_wasm_serialization.ts` fails on a pre-existing broken import (`../src/lib/rpc/serialization`); unrelated to this spec (core-only changes).
</content>
