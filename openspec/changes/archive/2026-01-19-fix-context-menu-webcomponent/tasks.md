# Implementation Tasks

## 1. Create Web Component Infrastructure
- [x] 1.1 Create `core/src/ui/components/` directory
- [x] 1.2 Create `core/src/ui/components/index.ts` for exports

## 2. Implement Core Context Menu Component
- [x] 2.1 Create `core/src/ui/components/context_menu.ts`
- [x] 2.2 Implement `MolvisContextMenu` class extending `MolvisElement`
- [x] 2.3 Implement `show(x, y, items)` method
- [x] 2.4 Implement `hide()` method
- [x] 2.5 Add viewport boundary detection and repositioning
- [x] 2.6 Add Shadow DOM styling for menu container

## 3. Implement Menu Item Components
- [x] 3.1 Create `core/src/ui/components/button.ts` for `molvis-button`
- [x] 3.2 Create `core/src/ui/components/separator.ts` for `molvis-separator`
- [x] 3.3 Create `core/src/ui/components/folder.ts` for `molvis-folder`
- [x] 3.4 Create `core/src/ui/components/slider.ts` for `molvis-slider`
- [x] 3.5 Implement data binding for each component
- [x] 3.6 Add Shadow DOM styling for each component

## 4. Register Components
- [x] 4.1 Update `core/src/core/app.ts` to import components
- [x] 4.2 Call `customElements.define()` for each component
- [x] 4.3 Ensure registration happens before any mode initialization

## 5. Fix Type Imports
- [x] 5.1 Update `core/src/core/context_menu_controller.ts` import path
- [x] 5.2 Export `MolvisContextMenu` interface/type from component file

## 6. Verification
- [x] 6.1 Test context menu in View mode (right-click)
- [x] 6.2 Test context menu in Select mode (right-click)
- [x] 6.3 Test context menu in Edit mode (right-click on empty space)
- [x] 6.4 Test element selector dropdown in Edit mode
- [x] 6.5 Test bond order selector in Edit mode
- [x] 6.6 Verify menu positioning at screen edges
- [x] 6.7 Verify menu closes on outside click
- [x] 6.8 Verify menu closes on Escape key
