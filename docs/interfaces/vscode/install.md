# Install the VS Code extension

MolVis requires VS Code 1.120.0 or newer, matching the extension manifest.

## Marketplace

Open Extensions with Ctrl/Cmd+Shift+X, search for **MolVis**, verify the
publisher is **molcrafts**, and select Install.

You can also open the
[Visual Studio Marketplace listing](https://marketplace.visualstudio.com/items?itemName=molcrafts.molvis).

## Open VSX and VSIX

- VSCodium-compatible hosts can use the
  [Open VSX listing](https://open-vsx.org/extension/molcrafts/molvis).
- For an offline installation, build a `.vsix` in `vsc-ext/`
  (`npx vsce package --no-dependencies`) and run
  **Extensions: Install from VSIX…**.

## Verify activation

After installation:

1. confirm a single **MolVis** icon appears in the Activity Bar;
2. open **Files** — workspace molecular files are listed; the title-bar
   action is **Open Structure…**;
3. run **MolVis: Open Stage** or **MolVis: Open Sketch** from the Command
   Palette — both open editor tabs.

The Activity Bar views are native trees. They do not allocate a WebGL
canvas until you open a Stage or Sketch tab.

Continue with [Quick look](quick-view.md).
