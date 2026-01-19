# Implementation Tasks

## 1. Interaction & Rendering Fixes
- [x] 1.1 Modify `core/src/ui/components/folder.ts`: Prevent duplicate rendering by checking if content exists.
- [x] 1.2 Modify `core/src/ui/components/button.ts`: Add `e.stopPropagation()` to click handler.
- [x] 1.3 Modify `core/src/ui/components/slider.ts`: Add `e.stopPropagation()` to change/input handlers.
- [x] 1.4 Modify `core/src/ui/components/context_menu.ts`: Add global click interceptor if needed (though item-level prop stopping is clearer).

## 2. Menu Redesign
### Select Mode
- [x] 2.1 Update `core/src/mode/select.ts`: Add "Clear Selection" button to menu.

### View Mode
- [x] 2.2 Update `core/src/mode/view.ts`: Add "Reset Camera" button to menu.

### Edit Mode
- [x] 2.3 Update `core/src/mode/edit.ts`:
  - Move "Element" binding to top level.
  - Move "Bond Order" binding to top level.
  - Remove "Atom" and "Bond" folders.
  - Add visual separators between Creation/Action sections.

## 3. Verification
- [x] 3.1 Verify duplicate bug is fixed (open menu multiple times).
- [x] 3.2 Verify click-through bug is fixed (click button over atom -> no selection/deletion).
- [x] 3.3 Verify Edit mode menu structure (flat, accessible).
- [x] 3.4 Verify View mode reset camera action.
- [x] 3.5 Verify Select mode clear selection action.
