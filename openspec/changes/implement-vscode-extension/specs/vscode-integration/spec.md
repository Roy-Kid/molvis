# vscode-integration Specification

## Purpose
Define requirements for integrating molvis molecular visualization into VS Code as an extension, enabling developers to view molecular structures directly within their IDE workspace.

---

## ADDED Requirements

### Requirement: Extension Activation
The extension MUST activate when a user invokes a molvis command.

#### Scenario: Activate on command
- **GIVEN** VS Code is running with the molvis extension installed
- **WHEN** the user opens the Command Palette and selects "Molvis: Open Viewer"
- **THEN** the extension SHALL activate if not already active
- **AND** the activation process SHALL complete without errors

---

### Requirement: Viewer Panel Command
The extension MUST provide a command to open a molecular visualization panel.

#### Scenario: Open viewer from Command Palette
- **GIVEN** the extension is active
- **WHEN** the user executes the "Molvis: Open Viewer" command
- **THEN** a webview panel SHALL open in the active editor group
- **AND** the panel title SHALL be "Molvis"
- **AND** the panel SHALL display a working 3D canvas

#### Scenario: Reuse existing panel
- **GIVEN** a molvis viewer panel is already open
- **WHEN** the user executes "Molvis: Open Viewer" again
- **THEN** the extension SHALL reveal the existing panel instead of creating a new one
- **AND** the panel SHALL become the active editor

---

### Requirement: Webview Initialization
The webview MUST correctly initialize the molvis core visualization engine.

#### Scenario: Mount molvis core
- **GIVEN** a webview panel is created
- **WHEN** the webview HTML loads
- **THEN** the webview SHALL locate the DOM container element
- **AND** the webview SHALL call `mountMolvis()` with valid configuration
- **AND** `mountMolvis()` SHALL return a MolvisApp instance
- **AND** the MolvisApp SHALL start its rendering loop

#### Scenario: Display default scene
- **GIVEN** molvis core is mounted and started
- **WHEN** the webview is fully loaded
- **THEN** the 3D canvas SHALL display a black background
- **AND** a grid SHALL be visible if enabled in config
- **AND** the camera SHALL respond to mouse input (rotate, pan, zoom)
- **AND** the UI overlay SHALL display mode/view/info panels if showUI is true

---

### Requirement: Viewport Responsiveness
The webview MUST resize the 3D canvas when the panel dimensions change.

#### Scenario: Resize panel
- **GIVEN** a molvis viewer panel is open
- **WHEN** the user drags a panel splitter to resize the panel
- **THEN** the webview SHALL detect the resize event via ResizeObserver
- **AND** the webview SHALL call `app.resize()`
- **AND** the 3D canvas SHALL update its dimensions to match the new panel size
- **AND** the aspect ratio SHALL adjust without distortion

#### Scenario: Switch between panels
- **GIVEN** a molvis viewer panel is in a tab group
- **WHEN** the user switches to another tab and back
- **THEN** the molvis canvas SHALL remain correctly sized
- **AND** the rendering loop SHALL continue without interruption

---

### Requirement: Resource Cleanup
The webview MUST properly release resources when the panel is closed.

#### Scenario: Close panel
- **GIVEN** a molvis viewer panel is open
- **WHEN** the user closes the panel
- **THEN** the webview SHALL disconnect the ResizeObserver
- **AND** the webview SHALL call `app.destroy()`
- **AND** Babylon.js SHALL release WebGL contexts and memory
- **AND** no memory leaks SHALL be detectable in DevTools

---

### Requirement: Content Security Policy
The webview MUST enforce a Content Security Policy that allows molvis to function while maintaining security.

#### Scenario: CSP allows WASM compilation
- **GIVEN** the webview HTML is generated
- **WHEN** the CSP header is set
- **THEN** the CSP SHALL include `script-src 'nonce-{nonce}' 'wasm-unsafe-eval'`
- **AND** WebAssembly compilation SHALL succeed
- **AND** molrs-wasm SHALL load without CSP violations

#### Scenario: CSP restricts unsafe scripts
- **GIVEN** the webview is running
- **WHEN** an attacker attempts to inject inline scripts without a nonce
- **THEN** the CSP SHALL block the script execution
- **AND** a CSP violation SHALL be logged to the console

#### Scenario: CSP allows Babylon.js styles
- **GIVEN** Babylon.js injects dynamic styles
- **WHEN** the webview renders
- **THEN** the CSP SHALL include `style-src 'unsafe-inline'`
- **AND** Babylon.js styles SHALL apply without CSP violations

---

### Requirement: Build Separation
The extension build MUST produce separate bundles for the extension host and webview.

#### Scenario: Build extension host
- **GIVEN** the build script is executed
- **WHEN** `npm run build:ext` runs
- **THEN** rslib SHALL bundle `src/extension.ts` to `out/extension.js`
- **AND** the output SHALL be in CommonJS format
- **AND** the `vscode` module SHALL be externalized
- **AND** the target SHALL be Node.js

#### Scenario: Build webview frontend
- **GIVEN** the build script is executed
- **WHEN** `npm run build:webview` runs
- **THEN** esbuild SHALL bundle `src/webview/index.ts` to `out/webview/index.js`
- **AND** the output SHALL be in ESM format
- **AND** the target SHALL be browser (ES2022)
- **AND** WASM files SHALL be bundled inline or emitted as separate files
- **AND** `__WASM_INLINE__=true` SHALL be defined

#### Scenario: Run full build
- **GIVEN** the user executes `npm run build`
- **THEN** both `build:ext` and `build:webview` SHALL run sequentially
- **AND** both `out/extension.js` and `out/webview/index.js` SHALL exist
- **AND** no build errors SHALL occur

---

### Requirement: Debug Configuration
The extension MUST be debuggable using VS Code's built-in debugger (F5).

#### Scenario: Launch Extension Development Host
- **GIVEN** the extension is built
- **WHEN** the developer presses F5
- **THEN** the preLaunchTask SHALL run (if configured)
- **AND** a new Extension Development Host window SHALL open
- **AND** the extension SHALL be loaded in the host
- **AND** breakpoints in `src/extension.ts` SHALL be hittable

#### Scenario: Debug webview frontend
- **GIVEN** a molvis viewer panel is open in the Extension Development Host
- **WHEN** the developer opens "Developer: Open Webview Developer Tools"
- **THEN** a Chrome DevTools window SHALL open for the webview
- **AND** the webview source SHALL be visible with source maps
- **AND** console logs from `src/webview/index.ts` SHALL appear

---

### Requirement: Error Handling
The extension MUST handle errors gracefully and provide useful diagnostics.

#### Scenario: Missing DOM container
- **GIVEN** the webview HTML is malformed
- **WHEN** `document.getElementById("molvis-container")` returns null
- **THEN** the webview SHALL throw a descriptive error
- **AND** the error message SHALL indicate the missing element ID
- **AND** the error SHALL be logged to the Extension Host console

#### Scenario: Core initialization failure
- **GIVEN** `mountMolvis()` throws an exception
- **WHEN** the webview attempts to mount core
- **THEN** the webview SHALL catch the exception
- **AND** the webview SHALL display an error message in the panel
- **AND** the extension host SHALL log the error with stack trace

---

### Requirement: Local Resource Access
The webview MUST only access resources from approved locations.

#### Scenario: Load webview bundle
- **GIVEN** the webview panel is created
- **WHEN** the webview HTML references `out/webview/index.js`
- **THEN** the extension SHALL convert the file URI to a webview URI using `webview.asWebviewUri()`
- **AND** the webview SHALL successfully load the script
- **AND** no CORS or access violations SHALL occur

#### Scenario: Restrict external resources
- **GIVEN** the webview is running
- **WHEN** the webview attempts to load a resource from an unapproved location
- **THEN** the webview SHALL block the request
- **AND** a CSP or security violation SHALL be logged

---

## Out of Scope (Future Enhancements)
- File format parsers (.pdb, .xyz, .mol2) - deferred to future change
- Two-way communication bridge (extension ↔ webview) - not needed for viewer-only MVP
- Custom file associations or editor providers - requires separate change
- State persistence across sessions - enhancement for v2
- Integration with Jupyter or Python environments - separate integration point
