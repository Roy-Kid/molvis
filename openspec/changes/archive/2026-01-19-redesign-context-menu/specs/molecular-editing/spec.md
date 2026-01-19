## MODIFIED Requirements

### Requirement: Element Selection
The system MUST provide a way to select the element for new atoms.

#### Scenario: Selection via Context Menu
- **GIVEN** the system is in Edit mode
- **WHEN** the user opens the context menu on an empty space
- **THEN** the top-level menu SHALL display an "Element" dropdown
- **AND** picking an element SHALL update the current drawing element
- **AND** the selection SHALL persist for subsequent operations

## ADDED Requirements

### Requirement: Bond Order Selection
The system MUST provide a way to select the bond order for new bonds.

#### Scenario: Selection via Context Menu
- **GIVEN** the system is in Edit mode
- **WHEN** the user opens the context menu on an empty space
- **THEN** the top-level menu SHALL display a "Bond Order" dropdown
- **AND** picking an order SHALL update the current drawing bond order
- **AND** the selection SHALL persist for subsequent operations

### Requirement: Edit Mode Context Menu
The context menu in Edit mode MUST provide quick access to common drawing parameters and actions.

#### Scenario: Menu Content
- **GIVEN** the system is in Edit mode
- **WHEN** the user right-clicks on empty space
- **THEN** the menu SHALL display:
  1. Element selector
  2. Bond Order selector
  3. Separator
  4. Snapshot button
- **AND** access to these items SHALL be immediate (no sub-folders)

### Requirement: View Mode Context Menu
The View mode context menu MUST provide navigation and utility actions.

#### Scenario: Menu Content
- **GIVEN** the system is in View mode
- **WHEN** the user right-clicks
- **THEN** the menu SHALL display:
  1. Reset Camera button
  2. Snapshot button

### Requirement: Select Mode Context Menu
The Select mode context menu MUST provide selection and utility actions.

#### Scenario: Menu Content
- **GIVEN** the system is in Select mode
- **WHEN** the user right-clicks
- **THEN** the menu SHALL display:
  1. Clear Selection button
  2. Snapshot button
