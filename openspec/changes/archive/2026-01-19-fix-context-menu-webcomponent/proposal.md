# Change: Fix Context Menu Web Component Implementation

## Why

The codebase currently has a broken context menu system. The `ContextMenuController` class references a web component `MolvisContextMenu` from `../ui/components/context_menu`, but this file and component do not exist. This causes the context menu functionality to fail silently across all modes (View, Select, Edit, Measure, Manipulate).

Each mode has its own context menu controller that extends `ContextMenuController` and provides mode-specific menu items, but the underlying web component infrastructure is missing.

## What Changes

- Create the missing `MolvisContextMenu` web component
- Implement supporting web components for menu items:
  - `molvis-button` (referenced in builder.ts)
  - `molvis-separator` (referenced in builder.ts)
  - `molvis-folder` (referenced in builder.ts)
  - `molvis-slider` (referenced in builder.ts for bindings)
- Ensure all components follow the existing `MolvisElement` base class pattern
- Register all web components properly in the application initialization
- Maintain compatibility with existing `MenuItem` interface and `createControl` builder function

## Impact

- **Affected specs**: `ui-components`
- **Affected code**:
  - `core/src/ui/components/` (new directory)
  - `core/src/ui/components/context_menu.ts` (new file)
  - `core/src/ui/components/button.ts` (new file)
  - `core/src/ui/components/separator.ts` (new file)
  - `core/src/ui/components/folder.ts` (new file)
  - `core/src/ui/components/slider.ts` (new file)
  - `core/src/core/app.ts` (component registration)
  - `core/src/core/context_menu_controller.ts` (type import fix)
- **Breaking changes**: None - this fixes existing broken functionality
