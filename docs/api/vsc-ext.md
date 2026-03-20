# VS Code Extension Reference

## Package

`vsc-ext/` packages the MolVis VS Code extension published as `molcrafts.molvis`.

## Commands

The extension contributes these user-facing commands:

- `molvis.quickView`: open a standalone preview panel for the current molecular file or an explicit URI
- `molvis.openEditor`: open the MolVis workspace webview
- `molvis.reload`: reload visible MolVis panels
- `molvis.save`: forward a save request to the active MolVis panel

## Custom Editor

The extension registers `molvis.editor` as a custom editor for:

- `*.pdb`
- `*.xyz`
- `*.data`

Quick View also accepts `.zarr` from the explorer context menu.

## Configuration

Two top-level settings are exposed:

- `molvis.config`: config overrides passed to `mountMolvis(container, config, settings)`
- `molvis.settings`: runtime settings overrides applied to the active app instance

See [core.md](core.md) for the underlying config and settings model.

## Engineering Commands

```bash
npm run build -w vsc-ext
npm run test:unit -w vsc-ext
npm run test:integration -w vsc-ext
```

- `test:unit` compiles `src/test/unit/**` and runs Mocha
- `test:integration` packages the extension, compiles test sources, and runs the VS Code extension host suite
