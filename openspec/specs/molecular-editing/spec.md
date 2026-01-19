# molecular-editing Specification

## Purpose
TBD - created by archiving change enhance-molecular-editing. Update Purpose after archive.
## Requirements
### Requirement: Draw Atom
Users MUST be able to add new atoms to the scene by clicking in empty space.

#### Scenario: Create atom on empty click
**Given** the user is in Edit mode
**When** the user left-clicks on empty space
**Then** a new atom is created at the click position with the currently selected element

#### Scenario: Preview atom before placement
**Given** the user is in Edit mode and hovering over empty space
**When** the user is about to click
**Then** a semi-transparent preview atom is shown at the cursor position

---

### Requirement: Draw Bond
Users MUST be able to create bonds between atoms by dragging.

#### Scenario: Create bond between existing atoms
**Given** the user is in Edit mode
**When** the user drags from one atom to another
**Then** a bond is created between the two atoms with the currently selected bond order

#### Scenario: Create new atom with bond
**Given** the user is in Edit mode and drags from an existing atom
**When** the user releases in empty space
**Then** a new atom is created AND a bond connects it to the starting atom

---

### Requirement: Delete Atom
Users MUST be able to delete atoms and their connected bonds.

#### Scenario: Delete atom on right-click
**Given** the user is in Edit mode
**When** the user right-clicks on an atom
**Then** the atom and all connected bonds are removed from the scene

---

### Requirement: Delete Bond
Users MUST be able to delete individual bonds.

#### Scenario: Delete bond on right-click
**Given** the user is in Edit mode
**When** the user right-clicks on a bond
**Then** only the bond is removed (atoms remain)

---

### Requirement: Undo/Redo
Users MUST be able to undo and redo edit operations.

#### Scenario: Undo last operation
**Given** the user has created an atom
**When** the user presses Ctrl+Z
**Then** the atom is removed

#### Scenario: Redo undone operation  
**Given** the user has undone an atom creation
**When** the user presses Ctrl+Y
**Then** the atom is restored

---

### Requirement: Element Selection
The system MUST provide a way to select the element for new atoms.

#### Scenario: Selection via Context Menu
- **GIVEN** the system is in Edit mode
- **WHEN** the user opens the context menu on an empty space
- **THEN** the top-level menu SHALL display an "Element" dropdown
- **AND** picking an element SHALL update the current drawing element
- **AND** the selection SHALL persist for subsequent operations

### Requirement: Select Atoms and Bonds
Users MUST be able to select both atoms and bonds in Select mode.

#### Scenario: Select atom with left-click
**GIVEN** the user is in Select mode
**WHEN** the user left-clicks on an atom
**THEN** the atom is highlighted and added to the selection

#### Scenario: Select bond with left-click
**GIVEN** the user is in Select mode
**WHEN** the user left-clicks on a bond
**THEN** the bond is highlighted and added to the selection

---

### Requirement: Incremental Multi-Selection
Users MUST be able to build up a selection set incrementally using Ctrl+click.

#### Scenario: Add atom to selection with Ctrl+click
**GIVEN** the user has selected one atom
**WHEN** the user Ctrl+left-clicks on another atom
**THEN** both atoms are highlighted and in the selection

#### Scenario: Remove atom from selection with Ctrl+click
**GIVEN** the user has selected an atom
**WHEN** the user Ctrl+left-clicks on the same atom
**THEN** the atom is deselected and removed from the selection

#### Scenario: Replace selection without Ctrl
**GIVEN** the user has selected multiple atoms
**WHEN** the user left-clicks (without Ctrl) on a different atom
**THEN** the previous selection is cleared and only the new atom is selected

---

### Requirement: Deselect on Empty Click
Users MUST be able to clear all selections by clicking on empty space.

#### Scenario: Clear selection on empty click
**GIVEN** the user has selected multiple atoms and bonds
**WHEN** the user left-clicks on empty space (not on any atom or bond)
**THEN** all selections are cleared and no entities are highlighted

---

### Requirement: Move Selected Entities
Users MUST be able to move selected atoms by dragging them in 3D space.

#### Scenario: Drag selected atoms to new position
**GIVEN** the user has selected one or more atoms
**WHEN** the user drags a selected atom
**THEN** all selected atoms move together maintaining their relative positions

#### Scenario: Update bonds during drag
**GIVEN** the user has selected atoms with connecting bonds
**WHEN** the user drags the selection
**THEN** the connected bonds update their positions in real-time

#### Scenario: Undo move operation
**GIVEN** the user has moved selected atoms
**WHEN** the user presses Ctrl+Z
**THEN** the atoms return to their original positions

---

### Requirement: Copy and Paste Selection
Users MUST be able to copy and paste selected molecular fragments.

#### Scenario: Copy selected atoms and bonds
**GIVEN** the user has selected atoms and bonds
**WHEN** the user presses Ctrl+C
**THEN** the selection is copied to an internal clipboard

#### Scenario: Paste at cursor position
**GIVEN** the user has copied a selection
**WHEN** the user presses Ctrl+V
**THEN** new atoms and bonds are created at the cursor position with the same relative geometry

#### Scenario: Auto-include connecting bonds in copy
**GIVEN** the user has selected multiple atoms
**WHEN** the user presses Ctrl+C
**THEN** bonds connecting the selected atoms are automatically included in the clipboard

#### Scenario: Undo paste operation
**GIVEN** the user has pasted a selection
**WHEN** the user presses Ctrl+Z
**THEN** the pasted atoms and bonds are removed

---

### Requirement: Selection Visual Feedback
Users MUST receive clear visual feedback about the current selection state.

#### Scenario: Highlight selected atoms
**GIVEN** the user has selected atoms
**WHEN** viewing the scene
**THEN** selected atoms are highlighted with a distinct color (yellow)

#### Scenario: Highlight selected bonds
**GIVEN** the user has selected bonds
**WHEN** viewing the scene
**THEN** selected bonds are highlighted with a distinct color (cyan)

#### Scenario: Show selection count
**GIVEN** the user has selected multiple entities
**WHEN** viewing the UI
**THEN** a selection count indicator shows "Selected: X atoms, Y bonds"

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

