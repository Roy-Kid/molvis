## ADDED Requirements

### Requirement: Command-Based Empty Viewer
The system SHALL provide a command to open an empty MolVis viewer in a new VSCode tab.

#### Scenario: Opening empty viewer via command
- **WHEN** the user executes the `MolVis: Open Viewer` command from the command palette
- **THEN** a new editor tab SHALL open containing an empty MolVis viewer
- **AND** the viewer SHALL display a black canvas with no molecules loaded
- **AND** the viewer SHALL show UI controls (if `showUI: true` in config)

#### Scenario: Drag-and-drop file loading in standalone viewer
- **GIVEN** an empty MolVis viewer is open via command
- **WHEN** the user drags a `.pdb` file from the file explorer and drops it into the viewer
- **THEN** the viewer SHALL load and display the molecular structure
- **AND** the viewer SHALL center the camera on the loaded molecule
- **AND** if the file is malformed, an error message SHALL be displayed in the viewer

### Requirement: Custom Text Editor Registration
The system SHALL register a Custom Text Editor for `.pdb` files, allowing users to visualize molecular structures as an alternative to the text editor.

#### Scenario: Opening .pdb file with Custom Editor
- **GIVEN** a `.pdb` file exists in the workspace
- **WHEN** the user opens the file
- **THEN** VSCode MAY open it in the MolVis Custom Editor (depending on user's default editor preference)
- **AND** the file SHALL be rendered as a 3D molecular visualization

#### Scenario: Switching between text and visualization views
- **GIVEN** a `.pdb` file is open in MolVis Custom Editor
- **WHEN** the user right-clicks the editor tab and selects "Reopen Editor With..." → "Text Editor"
- **THEN** the file SHALL reopen in VSCode's standard text editor
- **AND** the user SHALL be able to switch back to MolVis view using the same mechanism

#### Scenario: Multiple views of the same file
- **GIVEN** a `.pdb` file is open in MolVis Custom Editor
- **WHEN** the user opens the same file in a split view
- **THEN** both views SHALL display the same molecular structure
- **AND** changes to the underlying `TextDocument` SHALL sync across all views

### Requirement: Editor Title Button for Preview
The system SHALL provide an editor title button (similar to Markdown preview) to open MolVis visualization alongside the text editor.

#### Scenario: Opening preview to the side
- **GIVEN** a `.pdb` file is open in the text editor
- **WHEN** the user clicks the "Open Preview to the Side" button in the editor title bar
- **THEN** a new editor pane SHALL open to the right showing the MolVis visualization
- **AND** the text editor SHALL remain open on the left
- **AND** both panes SHALL display the same file

#### Scenario: Button visibility
- **GIVEN** the user has a file open in the text editor
- **WHEN** the file extension is `.pdb`
- **THEN** the "Open Preview to the Side" button SHALL be visible in the editor title bar
- **WHEN** the file extension is not `.pdb`
- **THEN** the button SHALL NOT be visible

### Requirement: Webview-Host Communication Protocol
The extension host and webview SHALL communicate via a well-defined message passing protocol.

#### Scenario: Extension host sends file to webview
- **GIVEN** a Custom Text Editor is opened for a `.pdb` file
- **WHEN** the extension host reads the file contents
- **THEN** it SHALL send a `loadFile` message to the webview containing the file content and filename
- **AND** the message SHALL conform to the `HostToWebviewMessage` type

#### Scenario: Webview signals ready state
- **GIVEN** a webview is initializing
- **WHEN** the MolVis renderer is fully initialized
- **THEN** the webview SHALL send a `ready` message to the extension host
- **AND** the extension host SHALL wait for this message before sending file data

#### Scenario: Error propagation from webview
- **GIVEN** a webview encounters an error (e.g., malformed file)
- **WHEN** the error occurs during parsing or rendering
- **THEN** the webview SHALL send an `error` message to the extension host
- **AND** the error message SHALL include a user-friendly description

### Requirement: File Access Layer
The extension host SHALL handle all file system access, and the webview SHALL never directly access files.

#### Scenario: Reading file contents
- **GIVEN** a `.pdb` file is opened in the Custom Editor
- **WHEN** the extension host needs to load the file
- **THEN** it SHALL use VSCode's `TextDocument` API to read the contents
- **AND** it SHALL send the contents as a string to the webview via message passing

#### Scenario: Handling file read errors
- **GIVEN** a file cannot be read (e.g., permissions issue)
- **WHEN** the extension host attempts to read the file
- **THEN** it SHALL send an `error` message to the webview
- **AND** the webview SHALL display a user-friendly error message

### Requirement: Content Security Policy for Webview
The webview SHALL enforce a Content Security Policy that allows Babylon.js and WASM execution while maintaining security.

#### Scenario: CSP allows required resources
- **GIVEN** a webview is created
- **WHEN** the CSP is configured
- **THEN** it SHALL allow `script-src` from webview resources and `wasm-unsafe-eval`
- **AND** it SHALL allow `img-src` from webview resources, HTTPS, and data URIs
- **AND** it SHALL allow `style-src` from webview resources and `unsafe-inline`
- **AND** it SHALL set `default-src 'none'` to deny all other sources

#### Scenario: Babylon.js and WASM load successfully
- **GIVEN** a webview with the configured CSP
- **WHEN** the webview script loads Babylon.js and `molrs-wasm`
- **THEN** both libraries SHALL load without CSP violations
- **AND** the MolVis renderer SHALL initialize successfully

### Requirement: Small File Limitation
The extension SHALL only support small text-based molecular files (< 10MB) in this phase.

#### Scenario: Loading small file
- **GIVEN** a `.pdb` file is less than 10MB
- **WHEN** the file is opened in MolVis
- **THEN** it SHALL load and render successfully

#### Scenario: Large file warning
- **GIVEN** a `.pdb` file is larger than 10MB
- **WHEN** the user attempts to open it in MolVis
- **THEN** the extension MAY display a warning message
- **AND** the extension MAY fall back to text editor mode
- **OR** the extension MAY attempt to load it with degraded performance

### Requirement: Read-Only Visualization
The Custom Editor SHALL be read-only; users cannot edit molecular structures in this phase.

#### Scenario: No editing UI
- **GIVEN** a `.pdb` file is open in MolVis Custom Editor
- **WHEN** the viewer is displayed
- **THEN** it SHALL NOT provide editing tools (e.g., atom manipulation, bond creation)
- **AND** it SHALL only provide view controls (camera, zoom, rotation)

#### Scenario: Text document editing
- **GIVEN** a `.pdb` file is open in both text editor and MolVis preview
- **WHEN** the user edits the text in the text editor
- **THEN** the MolVis preview SHALL update to reflect the changes
- **AND** the user SHALL be able to edit the molecular structure by editing the text
