# Sink the App abstraction into core

## Summary

`core` is a utility bag (`elements`, `keys`, `molrs`, `opfs`, `platform`,
`save_file`, `image_crop`, `element_picker`) with no shared abstractions. The
App concept exists once, in `stage`, welded to Babylon. Everything that wants
to name an app therefore depends on the 3D engine — including `sketch`, which
could not, and so re-implemented the parts it needed.

This spec sinks the engine-neutral half of the App into `core`, makes `stage`
and `sketch` two implementations of it, gives each engine ownership of its own
plugin contribution types, and turns `plugin` into the single facade plugin
authors import.

Target graph:

```
                    ┌─→ stage ──┐
core (App + 契约) ──┤           ├─→ plugin (facade) ─→ page
                    └─→ sketch ─┘
```

## Domain basis

Measured on `release/v0.2.0`, not assumed:

| Fact | Evidence |
|------|----------|
| `sketch` duplicates the command/undo semantics | `sketch/src/sketch_history.ts`: *"Semantics mirror core CommandManager (execute clears redo) without importing core"* |
| …and says why | `sketch/src/sketch_command.ts`: *"Independent of molvis-core Command (no MolvisApp)"* |
| `Command` is welded to the 3D app | `stage/src/commands/base.ts:74` `protected app: MolvisApp` |
| The weld is the only blocker | 27 `extends Command` sites; the bodies use `world`(44), `artist`(16), `overlayManager`(10) — stage-specific, but reached **through** a hard-coded app type |
| Engine-neutral app surface is small | `page` reads `events`(89), `settings`(37), `system`(29), `commandManager`(8); the rest (`world` 22, `modifierPipeline` 37, `canvas` 4, `styleManager` 6) is Babylon |
| Plugin contract touches stage in 4 places only | `PluginAPI`: `app`←Molvis, `modifiers`←Modifier, `modes`←PluginModeFactory, `overlays`←Overlay |
| Only one official plugin uses `api.app` | `plugins/pyodide-molpy/src/index.tsx` |
| `sketch` has no events/commands/system layer | no `EventEmitter`, no `CommandRegistry`; `board.subscribe(cb)` hand-rolled |
| molrs is already core-owned | `core/src/molrs.ts` is the only `@molcrafts/molrs` importer |

## Design

### 1. `Command` becomes generic over its app

The decoupling is **type-level, not behavioural**. `Command` keeps its `app`
handle; the handle's type becomes a parameter:

```ts
// core/src/command.ts
export abstract class Command<TApp, R = void> {
  constructor(protected app: TApp) {}
  abstract do(): R;
  abstract undo(): void;
}
export class CommandManager<TApp> { execute(c: Command<TApp, unknown>): void; undo(); redo(); }
```

- `stage`: `class DrawFrameCommand extends Command<StageApp>` — **bodies unchanged**,
  `this.app.world` still resolves.
- `sketch`: its commands extend `Command<SketchBoard>`; `SketchCommand` and
  `SketchHistory` are deleted.

This is what makes the sink cheap: 27 declaration sites gain a type argument;
no command body is rewritten.

### 2. `App` interface in core

Only what both engines have and consumers actually read:

```ts
export interface App {
  readonly events: EventEmitter<AppEventMap>;
  readonly commandManager: CommandManager<this>;
  stop(): void;
  destroy(): void;
}
```

`EventEmitter` sinks with it. **`Settings` does not** — Task 1 measured 8
Babylon references in `stage/src/settings.ts`, so per that task's own rule it
is excluded and stays in stage.

**Stays in stage**: `world`, `canvas`, `artist`, `styleManager`,
`overlayManager`, `modifierPipeline`, `System`/`Trajectory`.
**Stays in sketch**: `MoleculeGraph`, board, style tokens.

`System` and `MoleculeGraph` are different domain models and are **not**
unified.

### 3. Each engine owns its plugin contribution types

`Modifier`, `Overlay`, `PluginMode`, `PluginModeFactory`, `StageApp` are
stage's own concepts (a `Modifier` receives `PipelineContext`, which carries
the renderer — it cannot be engine-neutral). `stage` exposes them on a
`@molcrafts/molvis-stage/plugin` subpath. `sketch` may later add its own.

### 4. `plugin` is a facade

Re-exports, and defines almost nothing itself:

| From | What |
|------|------|
| `core` | `App`, `Command`, engine-neutral contract (log/storage/dialogs/panels/settings/caches/rpc/commands) |
| `stage/plugin` | `StageApp`, `Modifier`, `Overlay`, `PluginMode*` |
| itself | `MolvisPlugin` base, design tokens, `/ui`, `/css`, `pluginExternals` |

Plugin authors keep importing one package. `plugin` sits **downstream** of the
engines — correct for a facade, and the reason it may depend on `stage`.

### 5. `page` loses its forwarding layer

`page/src/plugins/{contract,contract_tokens,engine}.ts` and `kit/` are pure
re-exports of the SDK; page consumes `@molcrafts/molvis-plugin` directly.
Direction is unchanged (page stays downstream).

## Files

**core** — new: `src/command.ts`, `src/events.ts`, `src/settings.ts`,
`src/app.ts`; `package.json` exports `./app`, `./command`, `./events`.

**stage** — `src/commands/base.ts` (delete, re-export core), `manager.ts`
(delete), 27 `extends Command` sites gain `<StageApp>`; `src/app.ts`
(`implements App`, rename `MolvisApp`→`StageApp` with alias); new
`src/plugin.ts` + `./plugin` export; `src/mode/index.ts` (`PluginMode` moves
here from the earlier fix — already done).

**sketch** — delete `src/sketch_command.ts`, `src/sketch_history.ts`; commands
extend `Command<SketchBoard>`; new `src/app.ts` (`SketchApp implements App`);
`board.subscribe` replaced by `app.events`.

**plugin** — `src/contract.ts` shrinks to re-exports; `src/index.ts` adds the
stage surface.

**page** — delete `src/plugins/{contract,contract_tokens,engine}.ts`, `kit/`;
`src/ui/modes/edit/MolvisSketch.tsx` mounts `SketchApp`.

**tooling** — wireit deps (`plugin` → core+stage+sketch; `page` → plugin);
`molvis-plugins-official` link list + README; both CI workflows.

## Tasks

Each task ends green on its own; commit per task.

1. ~~**Verify the movable set is Babylon-free.**~~ **Done.**
   `stage/src/events.ts` 0 refs, `stage/src/commands/manager.ts` 0 refs →
   movable. `stage/src/settings.ts` **8 refs** → excluded, stays in stage.
2. **`Command<TApp>` + `CommandManager<TApp>` into core.** stage re-exports from
   its old paths for one release. 27 sites gain `<StageApp>`.
3. **`EventEmitter` into core**; `AppEventMap` (shared) + stage's map extends it.
4. **`App` interface into core**; `StageApp implements App`.
5. **sketch adopts it**: `SketchApp implements App`, delete `SketchCommand` /
   `SketchHistory`, commands extend `Command<SketchBoard>`.
6. **stage `/plugin` subpath** exports `Modifier`/`Overlay`/`PluginMode*`/`StageApp`.
7. **`plugin` becomes the facade**; delete its local type definitions.
8. **page drops the forwarding layer.**
9. **Retarget wireit + links + CI**; re-verify the cold-tree dev start and the
   plugins-official browser flow.

## Testing

- `stage`: 883 tests stay green after Tasks 2–4 (they are the safety net for
  the command migration).
- `core`: new unit tests for `CommandManager` undo/redo semantics — the
  behaviour `SketchHistory` copied, now asserted once.
- `sketch`: its command tests keep passing against the core base class.
- **Gate: core stays engine-free.** A test asserts `core/package.json` has no
  `@babylonjs*` dependency and no `core/src/**` file imports one.
- **Gate: no re-duplication.** A test asserts `sketch/src` contains no class
  implementing `do()`/`undo()` outside `Command` subclasses.
- End-to-end after Task 9: cold-tree `npm run dev:page` with zero unresolved
  imports; `plugins-official` five gates green; kernel starts and a cell runs.

## Out of scope

- Unifying `System` and `MoleculeGraph` (different domain models).
- Publishing `@molcrafts/molvis-plugin` (the link workflow stays).
- molrs ownership (already core's).
- `sketch` gaining modes/modifiers — only the App shape is shared.
