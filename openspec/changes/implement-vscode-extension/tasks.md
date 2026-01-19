# Implementation Tasks

All tasks are in `vsc-ext/` directory.

## Phase 1: Package Configuration
- [x] 1.1 Edit `vsc-ext/package.json`:
  - Add `"esbuild": "^0.25.0"` to devDependencies
  - Add scripts:
    ```json
    "build:ext": "rslib build",
    "build:webview": "esbuild src/webview/index.ts --bundle --format=esm --platform=browser --target=es2022 --outdir=out/webview --sourcemap --define:__WASM_INLINE__=false",
    "build": "npm-run-all -s build:ext build:webview"
    ```
  - Add contribution in `contributes.commands`:
    ```json
    {
      "command": "molvis.openViewer",
      "title": "Molvis: Open Viewer"
    }
    ```
- [x] 1.2 Run `npm install` in `vsc-ext/` to install esbuild

## Phase 2: Webview Frontend (Learn from page's core usage)
- [x] 2.1 Create `vsc-ext/src/webview/` directory
- [x] 2.2 Create `vsc-ext/src/webview/index.ts`:
  ```ts
  import { mountMolvis, type MolvisConfig } from "@molvis/core";

  const container = document.getElementById("molvis-container");
  if (!container) throw new Error("Missing container");

  const config: MolvisConfig = {
    fitContainer: true,
    showUI: true,
    grid: { enabled: true, mainColor: "#444", lineColor: "#666", opacity: 0.25, size: 10 }
  };

  const app = mountMolvis(container, config);  // Core API
  app.start();                                  // Core API

  const resizeObserver = new ResizeObserver(() => app.resize());  // Core API
  resizeObserver.observe(container);

  window.addEventListener("beforeunload", () => {
    resizeObserver.disconnect();
    app.destroy();  // Core API
  });
  ```

## Phase 3: Extension Host (VS Code API)
- [x] 3.1 Edit `vsc-ext/src/extension.ts` - Add utility:
  ```ts
  function getNonce(): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
  ```
- [x] 3.2 Add `getWebviewHtml()` function that generates HTML with:
  - CSP: `script-src 'nonce-{nonce}' 'wasm-unsafe-eval'`
  - Script tag loading `out/webview/index.js` via `webview.asWebviewUri()`
  - `<div id="molvis-container"></div>`
  - Styles: `html,body,#molvis-container { position:absolute; inset:0; margin:0; background:#000; }`
- [x] 3.3 Implement `molvis.openViewer` command:
  ```ts
  vscode.commands.registerCommand("molvis.openViewer", () => {
    const panel = vscode.window.createWebviewPanel(
      "molvis.viewer", "Molvis", vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [...] }
    );
    panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);
  });
  ```
- [x] 3.4 Register in `activate()` and push to `context.subscriptions`

## Phase 4: Build & Validate
- [x] 4.1 Run `npm run build` in `vsc-ext/`
- [x] 4.2 Verify output files exist:
  - `vsc-ext/out/extension.js` ✅
  - `vsc-ext/out/webview/index.js` ✅
- [x] 4.3 Press F5 to launch Extension Development Host (ready for user testing)
- [ ] 4.4 Open Command Palette (`Ctrl+Shift+P`) → Run `Molvis: Open Viewer` (requires F5)
- [ ] 4.5 Verify:
  - ✅ Webview panel opens
  - ✅ Black canvas background
  - ✅ Grid visible
  - ✅ Mouse rotate/pan/zoom works
  - ✅ No console errors (check both Extension Host and Webview DevTools)
- [ ] 4.6 Test resize: drag panel splitter, verify canvas updates

**Note**: Steps 4.3-4.6 require manual testing with F5 (Extension Development Host).

## Task Order
- Phase 1 → Phase 2 → Phase 3 → Phase 4 (sequential)
- No parallel work (simple linear flow)
