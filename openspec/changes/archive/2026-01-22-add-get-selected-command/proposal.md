# Change: Add Get Selected Command for Selection Query

## Why
In Select mode, users can select atoms and bonds, but there is no programmatic way to retrieve the selected entities' information. This limits the ability to build interactive workflows where Python code can query and act upon the user's current selection in the visualization.

## What Changes
- Add a new `get_selected` command to the frontend that returns selected entity metadata (atoms and bonds)
- Add a Python API method `get_selected()` that queries and returns the current selection from the frontend
- Add an internal TypeScript API on `SelectionManager` to retrieve selected entity metadata for use by other components

## Impact
- Affected specs: `selection` (new capability)
- Affected code:
  - `core/src/core/selection_manager.ts` - Add `getSelectedMeta()` method
  - `core/src/commands/` - Register new `get_selected` command
  - `python/src/molvis/commands/` - Add `SelectionCommandsMixin` with `get_selected()` method
  - `python/src/molvis/scene.py` - Mixin import
