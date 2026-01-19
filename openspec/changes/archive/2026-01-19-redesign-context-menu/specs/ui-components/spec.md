## ADDED Requirements

### Requirement: Click Isolation
Interactive menu components MUST consume pointer events to prevent propagation to the underlying canvas.

#### Scenario: Button Click
- **GIVEN** an open context menu over the 3D canvas
- **WHEN** the user clicks a menu button
- **THEN** the button action SHALL execute
- **AND** the click event SHALL NOT propagate to the canvas
- **AND** the canvas selection/manipulation SHALL NOT change

#### Scenario: Slider Interaction
- **GIVEN** an open context menu
- **WHEN** the user interacts with a slider or dropdown
- **THEN** the interaction events SHALL NOT propagate to the canvas

### Requirement: Idempotent Rendering
Web components MUST handle multiple render calls gracefully without duplicating content.

#### Scenario: Re-rendering
- **GIVEN** a `MolvisFolder` component
- **WHEN** `render()` is called multiple times (e.g., via data setter and connection)
- **THEN** the content SHALL only be rendered once
- **AND** no duplicate elements SHALL appear in the Shadow DOM

## MODIFIED Requirements
### Requirement: Binding Menu Item Component
The system MUST provide a `molvis-slider` web component for interactive controls (dropdowns, sliders).

#### Scenario: Rendering dropdown binding
- **GIVEN** a MenuItem with type "binding" and bindingConfig with view "list"
- **WHEN** the binding component renders
- **THEN** it SHALL display a label
- **AND** it SHALL display a dropdown with all options
- **AND** the current value SHALL be selected
- **AND** changing the selection SHALL invoke the action callback with the new value
- **AND** interaction SHALL NOT propagate to the canvas

### Requirement: Button Menu Item Component
The system MUST provide a `molvis-button` web component for clickable menu items.

#### Scenario: Rendering button
- **GIVEN** a MenuItem with type "button" and title "Snapshot"
- **WHEN** the button component renders
- **THEN** it SHALL display the title text
- **AND** it SHALL have hover styling
- **AND** clicking it SHALL invoke the action callback
- **AND** the click loop SHALL NOT propagate to the canvas
