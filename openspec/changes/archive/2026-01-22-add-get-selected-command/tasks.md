# Tasks: Add Get Selected Command

## 1. TypeScript SelectionManager Enhancement
- [x] 1.1 Add `getSelectedMeta()` method to `SelectionManager` class
- [x] 1.2 Define `GetSelectedResponse` type

## 2. TypeScript Command Registration
- [x] 2.1 Create `get_selected` command in `commands/selection.ts`
- [x] 2.2 Export command from `commands/index.ts`

## 3. Python Selection Commands
- [x] 3.1 Create `selection.py` with `SelectionCommandsMixin`
- [x] 3.2 Implement `get_selected()` method using bidirectional comm
- [x] 3.3 Add mixin export to `commands/__init__.py`
- [x] 3.4 Mix `SelectionCommandsMixin` into `Molvis` class

## 4. Verification
- [ ] 4.1 Manual test: Select atoms in Select mode, call `scene.get_selected()` in notebook
- [ ] 4.2 Verify response contains correct atom/bond metadata
