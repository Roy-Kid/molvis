## ADDED Requirements

### Requirement: Context Menu Web Component
The system MUST provide a `MolvisContextMenu` web component that displays context menus at specified screen coordinates.

#### Scenario: Showing context menu
- **GIVEN** a mode-specific context menu controller has menu items to display
- **WHEN** the controller calls `menu.show(x, y, items)`
- **THEN** the context menu SHALL appear at screen coordinates (x, y)
- **AND** the menu SHALL render all provided menu items in order
- **AND** the menu SHALL be positioned to stay within viewport bounds

#### Scenario: Hiding context menu
- **GIVEN** a context menu is currently visible
- **WHEN** the user clicks outside the menu or presses Escape
- **THEN** the menu SHALL hide
- **AND** any registered close callbacks SHALL be invoked

#### Scenario: Menu item interaction
- **GIVEN** a context menu with button items
- **WHEN** the user clicks a button item
- **THEN** the button's action callback SHALL execute
- **AND** the menu SHALL remain open unless explicitly closed

### Requirement: Button Menu Item Component
The system MUST provide a `molvis-button` web component for clickable menu items.

#### Scenario: Rendering button
- **GIVEN** a MenuItem with type "button" and title "Snapshot"
- **WHEN** the button component renders
- **THEN** it SHALL display the title text
- **AND** it SHALL have hover styling
- **AND** clicking it SHALL invoke the action callback

### Requirement: Separator Menu Item Component
The system MUST provide a `molvis-separator` web component for visual separation.

#### Scenario: Rendering separator
- **GIVEN** a MenuItem with type "separator"
- **WHEN** the separator component renders
- **THEN** it SHALL display a horizontal divider line
- **AND** it SHALL have appropriate spacing above and below

### Requirement: Folder Menu Item Component
The system MUST provide a `molvis-folder` web component for collapsible menu sections.

#### Scenario: Rendering folder
- **GIVEN** a MenuItem with type "folder", title "Atom", and nested items
- **WHEN** the folder component renders
- **THEN** it SHALL display the folder title
- **AND** it SHALL render all nested items below the title
- **AND** nested items SHALL be indented or visually grouped

### Requirement: Binding Menu Item Component
The system MUST provide a `molvis-slider` web component for interactive controls (dropdowns, sliders).

#### Scenario: Rendering dropdown binding
- **GIVEN** a MenuItem with type "binding" and bindingConfig with view "list"
- **WHEN** the binding component renders
- **THEN** it SHALL display a label
- **AND** it SHALL display a dropdown with all options
- **AND** the current value SHALL be selected
- **AND** changing the selection SHALL invoke the action callback with the new value

#### Scenario: Value persistence
- **GIVEN** a binding with initial value "C"
- **WHEN** the user changes the value to "N"
- **THEN** the binding SHALL call the action callback with `{value: "N"}`
- **AND** the visual display SHALL update to show "N" as selected

### Requirement: Web Component Registration
The system MUST register all context menu web components during application initialization.

#### Scenario: Component registration
- **GIVEN** the application is starting
- **WHEN** the app initialization completes
- **THEN** `molvis-context-menu` SHALL be registered as a custom element
- **AND** `molvis-button` SHALL be registered as a custom element
- **AND** `molvis-separator` SHALL be registered as a custom element
- **AND** `molvis-folder` SHALL be registered as a custom element
- **AND** `molvis-slider` SHALL be registered as a custom element
- **AND** all components SHALL be usable via `document.createElement()`
