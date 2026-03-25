# Tree Pipeline — Task Breakdown

## Phase 1: Core Data Model (2-3 days)

| # | Task | Owner | Acceptance Criteria |
|---|------|-------|---------------------|
| 1 | Create `PipelineTree` types | core | `SelectionScopeNode`, `ModifierNode`, `SelectionSource` in `core/src/pipeline/tree.ts` |
| 2 | `PipelineManager` with tree storage | core | `addScope()`, `removeScope()`, `addChildModifier()`, `reparentNode()` methods |
| 3 | `computeTree()` execution | core | Iterates roots depth-first, pushes scoped `currentSelection` per scope, passes to children |
| 4 | Tree events | core | `scope-added`, `scope-removed`, `node-reparented`, `scope-updated` events fire correctly |
| 5 | Tree compute unit tests | test | 6+ test cases: scoped selection, expression scope, disabled scope, empty scope, root modifier, topology change inside scope |

## Phase 2: Modifier Refactor (1-2 days)

| # | Task | Owner | Acceptance Criteria |
|---|------|-------|---------------------|
| 6 | TransparentSelectionModifier reads parent selection | core | When inside scope, reads `context.currentSelection`; postRenderEffect uses those indices |
| 7 | AssignColorModifier reads parent selection | core | Applies color to `context.currentSelection` indices |
| 8 | HideSelectionModifier reads parent selection | core | Filters atoms from `context.currentSelection` |
| 9 | DeleteSelectedModifier reads parent selection | core | Same as Hide |
| 10 | Modifier unit tests | test | Each modifier works with scoped context |

## Phase 3: UI — Tree Rendering (2-3 days)

| # | Task | Owner | Acceptance Criteria |
|---|------|-------|---------------------|
| 11 | Evaluate dnd-kit-sortable-tree vs custom | ui | Decision documented with rationale |
| 12 | `ScopeNodeItem` component | ui | Renders: chevron, enable checkbox, funnel icon, label, count badge, delete button. Expand/collapse children. |
| 13 | `PipelineTreeView` component | ui | Replaces PipelineList. Renders tree with indentation. Scope children indented 24px. |
| 14 | `ScopeProperties` panel | ui | Shows: label input, source type, atom/bond count, re-capture button, expression input (if expression source) |
| 15 | Wire to `usePipelineTabState` | ui | Hook reads from PipelineManager tree API instead of flat modifier array |

## Phase 4: UI — Full Interaction (2-3 days)

| # | Task | Owner | Acceptance Criteria |
|---|------|-------|---------------------|
| 16 | "Add Selection" button | ui | Creates scope from current SelectionManager state, auto-expands in tree |
| 17 | Context-aware "Add Modifier" | ui | Click on scope row → shows only selection-sensitive modifiers. Root → shows only global modifiers. |
| 18 | Drag re-parenting | ui | Modifier dragged into scope becomes child. Selection-sensitive modifier cannot be dragged to root. |
| 19 | Scope drag as group | ui | Dragging scope moves scope + all children together |
| 20 | Delete scope cascades | ui | Deleting scope removes all children, confirmation dialog |
| 21 | Scope toggle cascades | ui | Disabling scope disables all children visually |

## Phase 5: Cleanup (1 day)

| # | Task | Owner | Acceptance Criteria |
|---|------|-------|---------------------|
| 22 | Remove captured indices from modifiers | core | No more `_indices`, `_hiddenIndices`, `_deletedIndices` on selection-sensitive modifiers |
| 23 | Remove "Use Current Selection" UI | ui | No "Captured Atoms" count, no capture button in any modifier properties |
| 24 | Remove old flat `compute()` | core | Only `computeTree()` remains |
| 25 | Integration test suite | test | Full user flow: select → add scope → add child modifier → change scope → verify visual update |

## Total estimated effort: 8-12 days

## Recommended team allocation

- **Core engineer**: Phase 1 + 2 (data model + modifier refactor)
- **UI engineer**: Phase 3 + 4 (tree rendering + interaction)
- **Both**: Phase 5 (cleanup + integration tests)
