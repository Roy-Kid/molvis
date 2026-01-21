## ADDED Requirements
### Requirement: PerfPanel
The system MUST provide a PerfPanel overlay that displays the current FPS and matches the existing panel styling.

#### Scenario: Rendering FPS
- **GIVEN** UI overlays are enabled
- **WHEN** the render loop runs
- **THEN** the PerfPanel SHALL render in the bottom-right corner
- **AND** the displayed FPS SHALL be updated from `engine.getFps()`

#### Scenario: Disabled via config
- **GIVEN** `uiComponents.showPerfPanel` is false
- **WHEN** the UI overlay mounts
- **THEN** the PerfPanel SHALL NOT be rendered
