# Design: VSCode Extension Architecture

## Context

VSCode provides two primary mechanisms for custom UI:
1. **Webview Panels**: General-purpose UI containers that can be opened via commands
2. **Custom Editors**: File-type-aware editors that integrate with VSCode's document model

MolVis needs both: a command-based viewer for exploratory work and a Custom Editor for file-associated workflows. The extension must bridge VSCode's extension host (Node.js) with the Babylon.js-based webview (browser environment) while maintaining security boundaries.

**Constraints**:
- Webviews cannot directly access the file system; extension host must provide file contents
- Babylon.js requires WebGL and runs in the webview's browser context
- Content Security Policy (CSP) must allow WASM execution for `molrs-wasm`
- Small text files only (< 10MB); no streaming or chunking required

## Goals / Non-Goals

**Goals**:
- Enable visualization of `.pdb` files within VSCode
- Support both command-based and file-associated workflows
- Provide Markdown-like preview experience with editor title button
- Maintain clean separation between extension host and webview responsibilities

**Non-Goals**:
- Editing and saving molecular files (read-only for now)
- Large file optimization (streaming, lazy loading)
- Support for binary molecular formats
- Multi-file or trajectory visualization

## Decisions

### Decision 1: Use Custom Text Editor (not Custom Editor)

**Rationale**: `.pdb` files are text-based, and we don't need custom save logic. `CustomTextEditorProvider` gives us:
- Automatic integration with VSCode's `TextDocument`
- Built-in undo/redo and hot exit
- Simpler implementation (VSCode handles document lifecycle)

**Alternative considered**: `CustomEditorProvider` - Rejected because it requires implementing custom document model, save logic, and backup, which is unnecessary for read-only visualization.

### Decision 2: Dual Webview Strategy

**Architecture**:
- **Command-based viewer**: Uses `vscode.window.createWebviewPanel()` for standalone viewer
- **Custom Editor viewer**: Uses `CustomTextEditorProvider` with webview for file-associated editing

**Rationale**: These serve different use cases:
- Command viewer: Exploratory work, drag-and-drop, no file association
- Custom Editor: Integrated with file opening, side-by-side with text editor

**Shared components**: Both webviews use the same HTML template and webview script (`webview/index.ts`), differentiated by initialization messages.

### Decision 3: Message Passing Protocol

**Extension Host → Webview**:
```typescript
type HostToWebviewMessage =
  | { type: 'loadFile'; content: string; filename: string }
  | { type: 'init'; mode: 'standalone' | 'editor' }
  | { type: 'error'; message: string };
```

**Webview → Extension Host**:
```typescript
type WebviewToHostMessage =
  | { type: 'ready' }
  | { type: 'fileDropped'; filename: string }  // For drag-and-drop
  | { type: 'error'; message: string };
```

**Rationale**: Simple, type-safe protocol that separates concerns. Extension host handles file I/O, webview handles rendering.

### Decision 4: Editor Title Button via `editor/title` Contribution

**Implementation**: Register command `molvis.openPreviewToSide` in `package.json`:
```json
{
  "command": "molvis.openPreviewToSide",
  "when": "resourceExtname == .pdb",
  "group": "navigation"
}
```

**Rationale**: Matches VSCode's Markdown preview UX. Users familiar with Markdown will immediately understand the workflow.

### Decision 5: File Format Support Strategy

**Phase 1 (this change)**: `.pdb` only
**Future phases**: `.xyz`, `.cif`, `.mol2` via parser registry

**Rationale**: Start with most common format. Architecture supports extension via parser plugins in `@molvis/core`.

## Architecture Diagram

```mermaid
graph TB
    subgraph "VSCode Extension Host"
        A[extension.ts]
        B[customEditor.ts<br/>CustomTextEditorProvider]
        C[webviewMessaging.ts<br/>Message Protocol]
    end
    
    subgraph "Webview Browser Context"
        D[webview/index.ts]
        E[@molvis/core<br/>Babylon.js Renderer]
    end
    
    F[User Opens .pdb]
    G[User Runs Command]
    H[File System]
    
    F --> B
    G --> A
    B --> C
    A --> C
    C -->|postMessage| D
    D -->|postMessage| C
    C --> H
    D --> E
    
    style A fill:#e1f5ff
    style B fill:#e1f5ff
    style C fill:#e1f5ff
    style D fill:#fff4e1
    style E fill:#fff4e1
```

## Component Responsibilities

### Extension Host Components

**`extension.ts`**:
- Register commands (`molvis.openViewer`, `molvis.openPreviewToSide`)
- Register Custom Text Editor provider
- Manage webview panel lifecycle

**`customEditor.ts`**:
- Implement `CustomTextEditorProvider` interface
- Create and configure webview for Custom Editor
- Listen to `TextDocument` changes and sync to webview
- Handle webview disposal

**`webviewMessaging.ts`**:
- Define TypeScript types for message protocol
- Provide helper functions for sending/receiving messages
- Handle file reading and error propagation

### Webview Components

**`webview/index.ts`**:
- Initialize MolVis renderer
- Set up message listener for file loading
- Parse molecular file formats (delegate to `@molvis/core`)
- Handle drag-and-drop events (for standalone viewer)
- Send ready/error messages to extension host

## Security Considerations

**Content Security Policy**:
- `script-src`: Allow webview scripts and `wasm-unsafe-eval` for WASM
- `img-src`: Allow data URIs for inline images
- `default-src 'none'`: Deny all other sources

**File Access**:
- Extension host reads files, never webview
- Webview receives file contents as strings (no direct file:// access)

## Migration Plan

**Phase 1: Core Architecture** (this change)
- Implement Custom Text Editor for `.pdb`
- Add command-based viewer
- Establish message protocol

**Phase 2: Enhanced UX** (future)
- Add file format auto-detection
- Support additional formats (`.xyz`, `.cif`)
- Add export/snapshot capabilities

**Phase 3: Advanced Features** (future)
- Large file optimization
- Edit and save support
- Multi-file/trajectory visualization

## Open Questions

1. **Should drag-and-drop work in Custom Editor mode?**
   - Current design: Only in standalone viewer
   - Alternative: Support in both modes
   - **Decision needed**: User feedback required

2. **How should we handle malformed files?**
   - Option A: Show error message in webview
   - Option B: Fall back to text editor
   - **Recommendation**: Option A (show error in webview with "Open as Text" button)

3. **Should we support split view by default?**
   - Current design: User clicks button to open side-by-side
   - Alternative: Auto-open split view when `.pdb` file is opened
   - **Recommendation**: Keep manual (less intrusive)
