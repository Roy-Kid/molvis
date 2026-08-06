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

Users only ever type a **GitHub repo** — never a release download URL.

1. **Settings → Plugins** — `owner/repo` (→ **latest Release**) or
   `owner/repo@v1.2.3`. Local debug only: `http://127.0.0.1:4173/`.
2. **VS Code** — `"molvis.plugins": ["owner/repo@v1.2.3"]` then reload view.
3. **Python** — `Molvis(plugins=["owner/repo@v1.2.3"])` or URL `?plugins=…`.

**What the host does:** short key → GitHub Release base
(`…/releases/download/{tag}/`) → fetch `molvis.plugin.json` → resolve relative
`entry` (`plugin.js`, or `dist/plugin.js` rewritten to flat `plugin.js` on
Release layout). Settings / storage keep `owner/repo[@tag]` only.

**Distribution:** plugins ship **built assets on GitHub Releases** (flat files:
`molvis.plugin.json` + `plugin.js` + any workers). `dist/` is **not** committed.
CI builds on every PR; tagging `v*` runs the release workflow and uploads assets.

Trust model: remote code runs in the page; no allowlist. Only install trusted sources.

`localStorage` (`molvis.plugins.v1`) persists Settings installs; host inject merges and enables listed sources.

## Package layout

```
my-plugin/
  molvis.plugin.json      # entry: dist/plugin.js (local) / plugin.js (Release)
  dist/                   # gitignored — npm run build
  src/
    index.tsx             # activate → domain registers (optional MolvisPlugin class)
    plugin/               # optional OOP entry base
    modifiers/…
    modes/…
    analysis/…
    commands/…
    overlays/…
    settings/…
```

### Manifest

Repo-root `molvis.plugin.json` points at **relative** assets only — never absolute
CDN/release URLs. Users install the **repo**, not this file’s path.

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "0.2.0",
  "molvis": ">=0.2.0",
  "entry": "dist/plugin.js"
}
```

- **Local serve:** `entry` stays `dist/plugin.js` next to the repo-root manifest
  (or serve `dist/` and use a local manifest there).
- **Release packaging** (`prepare-release-assets.mjs`): rewrites `entry` →
  `"plugin.js"` and uploads flat assets. The host also strips a leading
  `dist/` when `layout === "release"`, so a non-rewritten manifest still loads.

### Multi-chunk

Host recursively rewrites **relative** imports under the entry URL into blob
modules. Host peers (`react`, `@molcrafts/molvis-stage`,
`@molcrafts/molvis-core/molrs`, `@molcrafts/molplot`) must stay external.
Workers for pyodide-kernel must sit next to `plugin.js` on the same Release.
## Build rules

Externalize via the host kit list (`page/src/plugins/kit/externals.ts`, vendored
as `plugin-externals.ts`): `react`, `react-dom`, `react/jsx-runtime`,
`@molcrafts/molvis-stage`, `@molcrafts/molvis-core/molrs`,
`@molcrafts/molvis-core/elements`, `@molcrafts/molplot` (never a second copy).

## Public SDK (never import `page/`)

Scaffold (Clack UI):

```bash
npx molvis-plugin create
npx molvis-plugin create my-plugin
npx molvis-plugin create my-plugin --id com.acme.demo --name "Acme Demo" -y
```

Import only umbrella re-exports:

```ts
import { MolvisPlugin, type PluginAPI, pluginExternals, token } from "@molcrafts/molvis/plugin";
import { Button } from "@molcrafts/molvis/plugin/ui";
import "@molcrafts/molvis/plugin/css";
```

| Path | Contents |
|------|----------|
| `@molcrafts/molvis/plugin` | `MolvisPlugin` base, contract types, tokens, `cn`, `pluginExternals` |
| `@molcrafts/molvis/plugin/ui` | Host-aligned shadcn primitives |
| `@molcrafts/molvis/plugin/css` | shadcn CLI CSS anchor (runtime theme is host-owned) |

Implementation may live under monorepo `plugin/` + `page/` (host loader), but
plugin **authors** must not name `page` in import paths. Runtime theme:
host `--molvis-*` tokens (`bg-accent`, `h-control`, `rounded-control`, …).

## Relation to compile-time extension

Fork-time extension still works as in [extending.md](./extending.md). Runtime
plugins wrap the same registries behind a dynamic loader.
