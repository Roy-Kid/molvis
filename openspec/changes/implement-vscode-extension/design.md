# Design Document: VS Code Extension Architecture

## Overview
This document shows how to use `@molvis/core` APIs in a VS Code extension. We learn the core API usage from `page`, but implement it for VS Code's webview architecture (not React).

## Architecture Diagram
```
┌─────────────────────────────────────────────────────────────┐
│ VS Code Extension Host (Node.js)                            │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ extension.ts (CJS bundle)                            │  │
│  │                                                       │  │
│  │  • activate() lifecycle                              │  │
│  │  • Command registration (molvis.openViewer)          │  │
│  │  • Webview panel creation                            │  │
│  │  • HTML generation + CSP headers                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           │ createWebviewPanel()             │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Webview Sandbox (Browser-like)                       │  │
│  │                                                       │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │ webview/index.ts (ESM bundle)                  │ │  │
│  │  │                                                 │ │  │
│  │  │  1. Select #molvis-container                   │ │  │
│  │  │  2. mountMolvis(container, config)             │ │  │
│  │  │  3. app.start()                                │ │  │
│  │  │  4. ResizeObserver → app.resize()              │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  │                           │                           │  │
│  │                           ▼                           │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │ @molvis/core (Babylon.js + WASM)               │ │  │
│  │  │                                                 │ │  │
│  │  │  • MolvisApp instance                          │ │  │
│  │  │  • 3D scene rendering                          │ │  │
│  │  │  • Interaction modes                           │ │  │
│  │  │  • UI overlays (ModePanel, InfoPanel, etc.)    │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Extension Host (`src/extension.ts`)
**Language**: TypeScript → CommonJS  
**Runtime**: Node.js (VS Code extension host process)  
**Responsibilities**:
- Activate on extension load or command invocation
- Register commands (`molvis.openViewer`)
- Create and manage webview panels
- Generate CSP-compliant HTML with proper nonces
- Map local file URIs to webview-accessible URIs
- Handle panel lifecycle (dispose, reveal, etc.)

**Key Constraints**:
- Cannot directly access browser APIs (DOM, Canvas, WebGL)
- Must use `vscode.window.createWebviewPanel()` for UI
- Must set `localResourceRoots` to limit webview file access
- Must handle async activation gracefully

### Webview Frontend (`src/webview/index.ts`)
**Language**: TypeScript → ES Modules  
**Runtime**: Browser-like sandbox (Chromium renderer)  
**Responsibilities**:
- Initialize DOM container (`#molvis-container`)
- Mount `@molvis/core` with configuration
- Start rendering loop (`app.start()`)
- Handle window resize events
- Clean up resources on panel close

**Key Constraints**:
- Runs in sandboxed iframe with CSP restrictions
- Cannot directly access VS Code APIs (no `acquireVsCodeApi()` needed yet)
- Must comply with CSP: `script-src 'nonce-XXX' 'wasm-unsafe-eval'`
- WASM files must be bundled inline or loaded via file:// URIs

### Build Pipeline
**Tools**: rslib (extension), esbuild (webview)

#### Extension Bundle
```json
{
  "format": "cjs",
  "target": "node",
  "bundle": true,
  "externals": { "vscode": "commonjs vscode" }
}
```
- Output: `out/extension.js`
- Entry: `src/extension.ts`
- Externals: VS Code API (`vscode` module)

#### Webview Bundle
```bash
esbuild src/webview/index.ts \
  --bundle \
  --format=esm \
  --platform=browser \
  --target=es2022 \
  --outdir=out/webview \
  --define:__WASM_INLINE__=true \
  --loader:.wasm=file
```
- Output: `out/webview/index.js` + `out/webview/*.wasm`
- Entry: `src/webview/index.ts`
- Dependencies: `@molvis/core`, `@babylonjs/core`, `molrs-wasm`
- WASM Handling: Inline WASM as base64 or emit as separate files

## Learning Core API from page

### Core API Pattern (from page/src/MolvisWrapper.tsx)
Page shows us the core API lifecycle:
```ts
// 1. Import
import { mountMolvis, type MolvisConfig } from '@molvis/core';

// 2. Mount
const app = mountMolvis(container, config);

// 3. Start
app.start();

// 4. Resize
app.resize();  // Call when container size changes

// 5. Cleanup
app.destroy();  // Call before unmount
```

### VS Code Webview Implementation (vsc-ext/src/webview/index.ts)
We use the **same core APIs**, but adapt to webview environment:
```ts
import { mountMolvis, type MolvisConfig } from "@molvis/core";

// 1. Get container (plain DOM, not React ref)
const container = document.getElementById("molvis-container");
if (!container) throw new Error("Missing container");

// 2. Configure (same options as page)
const config: MolvisConfig = {
  fitContainer: true,
  showUI: true,
  grid: { enabled: true, mainColor: "#444", lineColor: "#666", opacity: 0.25, size: 10 }
};

// 3. Mount + Start (same APIs as page)
const app = mountMolvis(container, config);
app.start();

// 4. Resize observer (same pattern as page)
const resizeObserver = new ResizeObserver(() => app.resize());
resizeObserver.observe(container);

// 5. Cleanup (webview lifecycle, not React useEffect)
window.addEventListener("beforeunload", () => {
  resizeObserver.disconnect();
  app.destroy();
});
```

**Key Point**: We use the exact same core APIs (`mountMolvis`, `app.start()`, `app.resize()`, `app.destroy()`), just wrapped in VS Code webview lifecycle instead of React hooks.

## Content Security Policy (CSP)

### Required Directives
```
default-src 'none';
img-src {cspSource} https: data:;
style-src {cspSource} 'unsafe-inline';
script-src {cspSource} 'nonce-{nonce}' 'wasm-unsafe-eval';
connect-src {cspSource} https:;
font-src {cspSource} https: data:;
```

### Rationale
- `wasm-unsafe-eval`: Required for WebAssembly compilation (molrs-wasm)
- `nonce-{nonce}`: Cryptographic nonce for inline/external scripts
- `'unsafe-inline'` for style-src: Babylon.js injects styles dynamically
- `https:` for img-src/connect-src: Future texture/model loading

### Security Trade-offs
- `wasm-unsafe-eval` is less restrictive than pure CSP, but unavoidable for WASM
- VS Code webviews are sandboxed; risk is contained to webview process
- Future: Consider moving to Trusted Types if VS Code supports it

## Future Extensions
VS Code Commands

The extension provides one command:

| Command ID | Title | What it does |
|------------|-------|--------------|
| `molvis.openViewer` | Molvis: Open Viewer | Opens a webview panel with 3D molecular viewer |

**How to invoke**:
- Command Palette: `Ctrl+Shift+P` → type "Molvis: Open Viewer"
- Future: Keybinding, file association, etc.

## Future Work (Out of Scope)
- Load molecular files (.pdb, .xyz, .mol2)
- Communication between extension host and webview (postMessage)
- Custom editor provider for file types
- Multiple viewer panels
- State persistence

## References
- VS Code Webview: https://code.visualstudio.com/api/extension-guides/webview
- Core API: `molvis/core/src/index.ts` (exports `mountMolvis`)
- Example usage: `molvis/