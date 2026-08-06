# `@molcrafts/molvis-plugin`

Authoring SDK for MolVis page plugins. Prefer the umbrella paths so you never
import monorepo internals (`page/…`):

```ts
import { MolvisPlugin, type PluginAPI, pluginExternals, token } from "@molcrafts/molvis/plugin";
import { Button, Checkbox } from "@molcrafts/molvis/plugin/ui";
import "@molcrafts/molvis/plugin/css"; // shadcn CLI anchor only
```

Scaffold a new plugin:

```bash
npm create @molcrafts/molvis-plugin@latest my-plugin
# or
npx @molcrafts/create-molvis-plugin my-plugin
```

## Exports

| Path | Contents |
|------|----------|
| `@molcrafts/molvis/plugin` | `MolvisPlugin`, contract types, tokens, `cn`, `pluginExternals` |
| `@molcrafts/molvis/plugin/ui` | Host-aligned shadcn (`Button`, `Checkbox`, `Select`, …) |
| `@molcrafts/molvis/plugin/css` | CSS anchor for shadcn CLI (theme is host-owned) |
| `@molcrafts/molvis/plugin` `components.json` via package | shadcn config |

Runtime theme tokens (`--molvis-*`) are provided by the MolVis host; do not ship a second palette.
