# Proposal: Implement VSCode Extension

## Problem Statement
The `vsc-ext` package exists but only has a placeholder "Hello World" command. It doesn't actually integrate `@molvis/core` for molecular visualization within VS Code.

## Proposed Solution
Implement the `vsc-ext` extension to provide molecular visualization in VS Code using `@molvis/core`.

### Learning from page
The `page` package shows how to use core:
```ts
import { mountMolvis } from '@molvis/core';
const app = mountMolvis(container, config);  // Create app instance
app.start();                                  // Start rendering loop
app.resize();                                 // Handle resize
app.destroy();                                // Cleanup
```

We'll use these same core APIs in the extension, but adapted for VS Code's webview architecture (not React).

### VS Code Commands
The extension will provide these commands:

| Command ID | Title | Description |
|------------|-------|-------------|
| `molvis.openViewer` | Molvis: Open Viewer | Open a 3D molecular viewer panel |

### Implementation Plan
1. **Extension Host** (`vsc-ext/src/extension.ts`): Register commands, create webview panels
2. **Webview Frontend** (`vsc-ext/src/webview/index.ts`): Use core API to mount visualization
3. **Build Pipeline**: Compile extension (rslib) + webview (esbuild with WASM support)

### Scope
**All work is in `vsc-ext/` package:**
- ✅ `vsc-ext/src/extension.ts`: Command registration (`molvis.openViewer`)
- ✅ `vsc-ext/src/webview/index.ts`: Mount core using `mountMolvis()` API
- ✅ `vsc-ext/package.json`: Add build scripts, contributions, esbuild dependency
- ✅ Build output: `vsc-ext/out/extension.js` + `vsc-ext/out/webview/index.js`

**Out of Scope:**
- Loading molecular files (no file parsers yet)
- Two-way messaging between extension host and webview
- Custom editors or file associations
- State persistence

## Impact Analysis
### Benefits
- Seamless molecular visualization within VS Code workspace
- Consistent core rendering across all molvis platforms (page/widget/extension)
- Foundation for future VS Code-specific features (file association, debugging tools)

### Risks
- **WASM Loading**: VS Code webview CSP requires `wasm-unsafe-eval`; ensure this is documented and properly configured
- **Bundle Size**: `@molvis/core` + Babylon.js dependencies may be large; consider lazy loading strategies if performance degrades
- **API Surface**: VS Code extension API changes between versions; document minimum engine version (`^1.108.1`)

### Affected Components (vsc-ext package only)
- `vsc-ext/src/extension.ts`: Register `molvis.openViewer` command
- `vsc-ext/src/webview/` (new directory)
- `vsc-ext/src/webview/index.ts` (new file): Call `mountMolvis()` from core
- `vsc-ext/package.json`: Add esbuild, update scripts, add command contribution

### Breaking Changes
None. This is a new component and does not modify existing packages.

## Alternatives Considered
1. **Custom Editor Provider**: More complex API, unnecessary for initial "viewer-only" scope
2. **Language Server Protocol**: Overkill for visualization; LSP is for code intelligence
3. **Native Module**: Electron allows native modules, but browser-based core is already proven and portable

## Dependencies
- VS Code Engine: `^1.108.1`
- `@molvis/core`: `file:../core` (workspace dependency)
- esbuild: For webview bundling with WASM support
- rslib: For extension host bundling (already configured)

## Success Criteria
1. ✅ `npm run build` in `vsc-ext/` produces `out/extension.js` and `out/webview/index.js`
2. ✅ F5 launches Extension Development Host without errors
3. ✅ Command Palette shows `Molvis: Open Viewer` command
4. ✅ Executing command opens webview with:
   - Black 3D canvas background
   - Visible grid (if enabled)
   - Working camera controls (rotate/pan/zoom with mouse)
   - No console errors

## Timeline Estimate
- **Setup & Build Config**: 1-2 hours (esbuild, rslib, tasks.json)
- **Extension Host Code**: 1 hour (command registration, webview creation)
- **Webview Frontend**: 1 hour (HTML template, mount core, CSP)
- **Testing & Debugging**: 1 hour (F5 workflow, error handling)

**Total**: ~4-5 hours of focused development

## Related Changes
- None (initial implementation)

## Related Specs
- **New**: `vscode-integration` spec (to be created)
