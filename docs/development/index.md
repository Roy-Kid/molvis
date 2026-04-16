# Development

This section is for developers who want to **embed** MolVis in their own
frontend or **extend** it with new commands, modifiers, or modes. End
users landing here by accident should read
[Getting Started](../getting-started/index.md) instead.

The engine that powers the web app, the VSCode extension, and the
Python widget is `@molcrafts/molvis-core`. It is published to npm and
can be consumed like any other library:

```bash
npm install @molcrafts/molvis-core
```

Or, if you are working inside this monorepo, every workspace already
resolves it from source via a TypeScript path alias — no rebuild of
`core/dist` is needed when iterating on `core/src/`.

## What you will find here

- **[Setup](setup.md)** — clone the monorepo, install dependencies,
  understand the workspace layout, start dev servers.
- **[Extending](extending.md)** — write a custom `Modifier`, register a
  new `Command`, add a `Mode`, plug a renderer into the `Artist`.

## The 30-second mental model

```
┌─────────────────────────────────────────────────────────────────┐
│ MolvisApp (app.ts)                                              │
│                                                                 │
│   ┌──────────────┐   ┌────────────────┐   ┌──────────────┐      │
│   │ World        │   │ System         │   │ Artist       │      │
│   │ scene,camera │   │ trajectory,    │   │ thin-instance│      │
│   │ lights       │   │ frame events   │   │ rendering    │      │
│   └──────────────┘   └────────────────┘   └──────────────┘      │
│          ▲                    ▲                   ▲             │
│          │                    │                   │             │
│   ┌──────┴──────┐   ┌─────────┴────────┐   ┌──────┴──────┐      │
│   │ ModeManager │   │ ModifierPipeline │   │ SceneIndex  │      │
│   │ 5 modes     │   │ modifier chain   │   │ GPU buffers │      │
│   └─────────────┘   └──────────────────┘   └─────────────┘      │
│          ▲                                                      │
│          │                                                      │
│   ┌──────┴──────────────────────────────────────────────┐       │
│   │ CommandManager — undo/redo, command registry         │       │
│   └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

Every user action flows through **commands** (so everything is
undoable). Data flows through the **pipeline** (so rendering always
reflects a deterministic function of the frame). The **Artist** owns
the GPU buffers and translates frame data into thin-instance draw
calls.

Knowing which layer a change belongs to is the most important skill
when working on MolVis. The [Extending](extending.md) page has the
layer cheatsheet.

## Related reading

- [TypeScript API Reference](../api/typescript.md) — every public
  export of `@molcrafts/molvis-core`.
- [Python widget API](../api/python.md) — the anywidget surface.
