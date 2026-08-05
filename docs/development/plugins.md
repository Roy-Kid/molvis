# Page plugins

MolVis loads third-party ESM plugins at runtime (Settings UI, VS Code
`molvis.plugins`, or Python `Molvis(plugins=[…])`).

## Domain-oriented contributions

Plugins extend **domains**. UI for a domain is registered **with that domain**
— there is no free-floating `api.ui` bag.

| Domain | Logic | UI (owned by the domain) |
|--------|--------|---------------------------|
| `modifiers` | pipeline factory | property panel (`register(..., { panel })`) |
| `modes` | interaction mode | tools panel (`register(..., { panel })` / `registerToolsPanel`) |
| `analysis` | compute | left Analysis picker + params + result (`register(spec)`) |
| `commands` | named action | optional toolbar (`register(..., { toolbar })`) |
| `overlays` | scene decoration | — |
| `settings` | plugin prefs | Settings section for *this* plugin |
| `rpc` | JSON-RPC | — |

Official scaffold (folders per domain):
[MolCrafts/molvis-plugin-template](https://github.com/MolCrafts/molvis-plugin-template).

Official **collection** (meta + per-plugin packages, e.g. LAMMPS eq input):
[MolCrafts/molvis-plugins-official](https://github.com/MolCrafts/molvis-plugins-official).

### API sketch

```ts
api.modifiers.register("Scale X", "Modification", () => new ScaleXModifier(), {
  panel: ScaleXPanel,
});

api.analysis.register({
  id: "my-rdf",
  label: "My RDF",
  params: [{ name: "bins", label: "Bins", kind: "int", default: 50 }],
  run: async ({ app, params }) => ({ data: { /* … */ } }),
  resultKind: "scalar",
  // optional: renderResult: ({ result }) => <… />,
});

api.commands.register("export-csv", fn, {
  toolbar: { label: "Export CSV" },
});

api.modes.register("highlight", (app) => new HighlightMode(app), {
  panel: { id: "hl-tools", title: "Highlight", render: HighlightTools },
});
// Or extend a built-in mode's tools column:
api.modes.registerToolsPanel("view", {
  id: "extra",
  title: "Extra",
  render: ExtraViewTools,
});

api.settings.registerSection({
  id: "prefs",
  title: "My plugin",
  render: PrefsForm,
});

api.overlays.add(overlay);
api.rpc.registerMethod("ping", () => "pong");
```

## Install

1. **Settings → Plugins** — paste `owner/repo` (no tag → **latest GitHub
   release**, else default-branch tip), `owner/repo@tag`, or HTTPS URL.
2. **VS Code** — `"molvis.plugins": ["owner/repo"]` then reload view.
3. **Python** — `Molvis(plugins=["owner/repo"])` or URL `?plugins=…`.

Trust model: remote code runs in the page; no allowlist. Only install trusted sources.

`localStorage` (`molvis.plugins.v1`) persists Settings installs; host inject merges and enables listed sources.

## Package layout

```
my-plugin/
  molvis.plugin.json
  dist/plugin.js          # entry (may import sibling chunks)
  src/
    index.tsx             # activate → domain registers
    modifiers/…
    modes/…
    analysis/…
    commands/…
    overlays/…
    settings/…
```

### Manifest

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "0.2.0",
  "molvis": ">=0.2.0",
  "entry": "dist/plugin.js"
}
```

### Multi-chunk

Host recursively rewrites **relative** imports under the entry URL into blob
modules. Host peers (`react`, `@molcrafts/molvis-stage`,
`@molcrafts/molvis-core/molrs`, `@molcrafts/molplot`) must stay external.

## Build rules

Externalize: `react`, `react-dom`, `react/jsx-runtime`, `@molcrafts/molvis-stage`,
`@molvis/stage`, `@molcrafts/molvis-core/molrs`, `@molcrafts/molvis-core/elements`,
`@molcrafts/molplot` (shared Vega charts — never bundle a second copy).

## Relation to compile-time extension

Fork-time extension still works as in [extending.md](./extending.md). Runtime
plugins wrap the same registries behind a dynamic loader.
