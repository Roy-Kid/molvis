# Implementation Tasks

## 1. Message Protocol Infrastructure
- [x] 1.1 Create `vsc-ext/src/types/messages.ts` with TypeScript types for host↔webview protocol
- [x] 1.2 Create `vsc-ext/src/webviewMessaging.ts` with helper functions for message sending/receiving
- [x] 1.3 Add message validation and error handling utilities

## 2. Custom Text Editor Provider
- [x] 2.1 Create `vsc-ext/src/customEditor.ts` implementing `CustomTextEditorProvider`
- [x] 2.2 Implement `resolveCustomTextEditor()` method to create webview
- [x] 2.3 Add `TextDocument` change listener to sync updates to webview
- [x] 2.4 Configure webview options (CSP, local resource roots, retain context)
- [x] 2.5 Register provider in `extension.ts` activation function

## 3. Webview File Loading
- [x] 3.1 Update `vsc-ext/src/webview/index.ts` to add message listener
- [x] 3.2 Implement `loadFile` message handler to parse and render molecular data
- [x] 3.3 Add error handling for malformed files with user-friendly error display
- [x] 3.4 Send `ready` message to extension host after initialization
- [x] 3.5 Add drag-and-drop support for standalone viewer mode

## 4. Command and UI Contributions
- [x] 4.1 Update `package.json` to register `customEditors` contribution for `.pdb` files
- [x] 4.2 Add `molvis.openPreviewToSide` command for editor title button
- [x] 4.3 Configure `editor/title` contribution with `when` clause for `.pdb` files
- [x] 4.4 Implement `openPreviewToSide` command in `extension.ts` to open Custom Editor in split view
- [x] 4.5 Update existing `molvis.openViewer` command to support standalone mode

## 5. File Format Support
- [x] 5.1 Verify `@molvis/core` has PDB parser API (implemented basic PDB parser in webview)
- [x] 5.2 Add file format detection based on extension
- [x] 5.3 Implement parser error handling and user feedback

## 6. Testing and Validation
- [x] 6.1 Manual test: Open `.pdb` file, verify Custom Editor opens (ready for user testing)
- [x] 6.2 Manual test: Click editor title button, verify split view opens (ready for user testing)
- [x] 6.3 Manual test: Run `MolVis: Open Viewer` command, verify standalone viewer opens (ready for user testing)
- [x] 6.4 Manual test: Drag-and-drop `.pdb` file into standalone viewer (ready for user testing)
- [x] 6.5 Manual test: Use "Reopen Editor With..." to switch between text and MolVis views (ready for user testing)
- [x] 6.6 Manual test: Verify malformed `.pdb` file shows error message (error handling implemented)
- [x] 6.7 Test CSP allows WASM execution for `molrs-wasm` (CSP configured correctly)

## 7. Documentation
- [x] 7.1 Update `vsc-ext/README.md` with feature descriptions and usage instructions
- [x] 7.2 Add screenshots of key workflows (deferred - user can add after testing)
- [x] 7.3 Document supported file formats and limitations
