# Acceptance — Sink the App abstraction into core

Binding criteria. Each states what must be observably true and how it is
checked. Status starts `pending`.

| # | Criterion | type | verified_by | status |
|---|-----------|------|-------------|--------|
| 1 | `core` declares no `@babylonjs*` dependency and no file under `core/src/**` imports one | structural | `test` (`core/tests/engine_free.test.ts`) | **met** (adding a fake `@babylonjs/core` dep fails it) |
| 2 | `Command` and `CommandManager` live in `core`; `stage/src/commands/{base,manager}.ts` hold only a **binding** to them (fixing the app type), no re-implementation | structural | `grep` + `typecheck` | **met** |
| 3 | The 12 command files in `stage/src/commands/` are **byte-identical**; only the two binding files change | correctness | `git diff --name-only stage/src/commands/` lists only `base.ts`, `manager.ts` | **met** |
| 4 | `stage`'s 883 tests pass unchanged after the command migration | regression | `npm run test:stage` | **met** (883/0) |
| 5 | `sketch/src/sketch_command.ts` and `sketch/src/sketch_history.ts` are deleted, and no replacement class in `sketch/src` defines both `do()` and `undo()` outside a `Command` subclass | structural | `test` (new gate) | pending |
| 6 | `CommandManager` undo/redo semantics (execute clears redo; undo/redo return false when empty) are asserted in `core`'s own tests | correctness | `npm run test:core` | **met** (8 tests; reverting the redo-clear fails exactly one) |
| 7 | `SketchApp` and `StageApp` both satisfy the `App` interface — assignability is checked by the compiler, not by a cast | correctness | `typecheck` | pending |
| 8 | `@molcrafts/molvis-stage/plugin` resolves and exports `Modifier`, `Overlay`, `PluginMode`, `PluginModeFactory`, `StageApp` | api | `typecheck` + import smoke test | pending |
| 9 | `plugin/src` defines no contract type of its own: every exported type is a re-export of `core` or `stage/plugin` (`MolvisPlugin`, tokens, `pluginExternals`, `cn` excepted) | structural | `grep` for `export interface`/`export type X =` in `plugin/src` | pending |
| 10 | `page/src/plugins/{contract,contract_tokens,engine}.ts` and `page/src/plugins/kit/` are gone; nothing under `page/src` references them | structural | `grep` | pending |
| 11 | The four official plugins compile against the facade with no import path changes beyond `api.app` consumers | integration | `plugins-official` `npm run typecheck` | pending |
| 12 | Cold-tree `npm run dev:page` (all engine `dist/` removed) brings the page up with **zero** `Module not found` errors | integration | manual run + log grep | pending |
| 13 | `plugins-official` gates all pass: `typecheck`, `lint:py`, `test`, `build`, `verify:bundle` | regression | those five scripts | pending |
| 14 | Browser end-to-end still works: 7 mode tabs present, pyodide kernel reaches ready, a notebook cell completes, zero console errors | integration | Playwright session | pending |
| 15 | `npm run check` in `molvis` passes (biome, typecheck, test-core, builds) | regression | pre-commit hooks | pending |

## Notes

- Criterion 3 is the load-bearing one for risk: if command bodies need editing,
  the generic-parameter design is wrong and the task should stop rather than
  grow into a rewrite.
- Criteria 2 and 3 were **rewritten during Task 2**. The spec assumed each of
  the 27 `extends Command<X>` sites would gain `<StageApp, X>`; that also
  required the `undo(): Command` return annotations, ~40 edits in 12 files.
  A single binding class in `stage/src/commands/base.ts` fixes the app type
  once and leaves every command file untouched — smaller diff *and* the
  clearer statement ("in stage, a Command acts on MolvisApp"). `sketch` will
  bind the same base to its board.
- Criterion 1 is the reason the sink is bounded — the moment `core` needs
  Babylon, too much has moved.
- Criteria 5 + 6 together are the payoff: the duplicate is gone *and* its
  semantics are asserted somewhere.
