# Change: Redesign Context Menu and Fix Interactions

## Why
The current context menu implementation suffers from critical usability and design issues:
1. **Interaction Bugs**: Clicking menu items propagates events to the canvas (click-through), and duplicate rendering issues have been reported.
2. **Poor Usability**: Key controls like "Element" and "Bond Order" are buried in sub-folders, requiring extra clicks.
3. **Inconsistent Design**: The menu structure varies unpredictably between modes and doesn't prioritize common actions.

## What Changes
1. **Fix Web Components**:
   - Add `stopPropagation` to all interactive menu components (`MolvisButton`, `MolvisSlider`, etc.) to prevent click-through.
   - Fix rendering logic in `MolvisFolder` to prevent duplicate item rendering.

2. **Redesign Menu Structure**:
   - **Edit Mode**: Flatten the hierarchy. Move "Element" and "Bond Order" selectors to the top level for immediate access. Group related actions with separators.
   - **View Mode**: Add "Reset Camera" alongside "Snapshot".
   - **Select Mode**: Add "Clear Selection" alongside "Snapshot".

3. **Enhance Components**:
   - Add a "Label" component for section headers (non-interactive).
   - Improve visual styling for better legibility.

## Impact
- **Affected Specs**: `ui-components`, `molecular-editing`
- **Affected Code**:
  - `core/src/ui/components/*.ts` (Web Components)
  - `core/src/mode/*.ts` (Mode context menu controllers)
