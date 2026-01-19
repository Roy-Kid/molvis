# pipeline-interactions Specification

## Purpose
TBD - created by archiving change pipeline-ui-redesign. Update Purpose after archive.
## Requirements
### Requirement: Interaction: Add Modifier
The system MUST allow users to add new modifiers to the pipeline.
#### Scenario: Opening the menu
  - GIVEN the user wants to add a process
  - WHEN they click the "Add Modifier" button
  - THEN a categorized dropdown/modal should appear.
  - AND it should list all registered modifiers (e.g., "Visual", "analysis", "Selection").

#### Scenario: Adding a modifier
  - GIVEN the modifier menu is open
  - WHEN the user selects "Draw Box"
  - THEN a new `DrawBoxModifier` instance should be appended to the end of the pipeline.
  - AND it should automatically become selected in the `PropertyEditor`.

### Requirement: Interaction: Toggle Visibility
The system MUST allow users to toggle the visibility/enabled state of modifiers.
#### Scenario: Disabling a step
  - GIVEN a modifier is currently enabled (functioning)
  - WHEN the user clicks its checkbox/eye icon in the stack
  - THEN the modifier should become disabled.
  - AND the visualization should re-render as if that step did not exist.
  - BUT the modifier should remain in the list (not deleted).

### Requirement: Interaction: Delete Modifier
The system MUST allow users to delete modifiers from the pipeline.
#### Scenario: Removing a step
  - GIVEN a modifier is selected
  - WHEN the user clicks the "Trash/Delete" icon
  - THEN the modifier should be removed from the pipeline entirely.
  - AND the visualization should re-render immediately.

