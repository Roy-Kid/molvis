---
status: code-complete
slug: stage-commit-scene
created: 2026-07-30
grilled: true
---

# stage-commit-scene

## Summary

Stage 采用类 git 的两层文档模型：所有 mode 共享 Babylon/molvis **working tree**
（`SceneIndex` edit pool）；仅 `commitScene()`（Ctrl+S）将 working tree 落入
**molrs HEAD**（`system.frame` + pipeline DataSource）。命令与 undo/redo 只改
working tree。Analysis 只读 HEAD；dirty 时提示用户保存。mode 切换不落盘、不弹窗。
仅在会毁掉未提交编辑的 destructive 操作前弹出「保存 / 不保存 / 取消」。

## Domain basis

对齐 `@molcrafts/molvis-sketch`：`MoleculeGraph` 为编辑真相，`toFrame()` 为边界
导出。Stage 的 `SceneIndex` 对应 working tree；`buildFrameFromScene` + DataSource
对应 commit。不引入新的科学模型。

## Design

### 两层文档

| 层 | 载体 | 规则 |
|----|------|------|
| Working tree | `SceneIndex`（edit pool + GPU meta） | 所有 mode 平等读写；CommandManager undo 只动此层 |
| HEAD | `system.frame` + `DataSourceModifier` | 仅 `commitScene()` 写入；analysis / export / pipeline composition 读此层 |

### API

- `MolvisApp.commitScene()`：`buildFrameFromScene` → 写入 trajectory；若无
  DataSource 且有原子则安装 `MemoryDataSource`（`sourceType: "empty"`,
  `filename: "Untitled"`）并 `applyAutoAttach`；`markAllSaved`；**不**
  `applyPipeline` full rebuild。
- `MolvisApp.discardScene()`：用当前 HEAD（`system.frame`）重建 scene；无结构则
  清空 artist/sceneIndex；`markAllSaved`；清空 command history。
- 删除或弃用作为主 API 的 `save()`；调用方改为 `commitScene`（兼容别名可短期保留
  并转发到 `commitScene`）。

### 命令与 mode

- Edit / Manipulate 命令路径 **禁止** 在 do/undo/redo 后自动 commit。
- Edit `finish()`：清理 preview/pending；**不** commit、**不** discard、**不**
  `restoreSceneFromFrame`（working tree 驻留）。
- Manipulate Save/Discard 菜单与 Ctrl+S 统一走 `commitScene` / `discardScene`。
- Mode 切换（UI / 键盘 / `setMode`）：不落盘、不弹窗。

### Analysis（page）

- 以 `frameHasStructure(system.frame)` 判断是否有 committed 数据。
- 若 `sceneIndex.hasUnsavedChanges`（dirty）：显示「请先保存场景（Ctrl+S）」类
  提示，禁用 Run；不 lazy commit。
- 无 committed 结构：保留「No structure loaded」。

### Destructive 门闩（page）

在 load replace / reset 等会清空或替换 scene 的路径上：若 dirty，弹出三键
「保存 / 不保存 / 取消」→ 分别 `commitScene` 后继续、`discardScene` 后继续、中止。

### Reuse decision

- **reuse** `buildFrameFromScene`（`scene_sync.ts`）作为唯一 dump 实现。
- **reuse** `sceneIndex.hasUnsavedChanges` / `dirty-change` 事件作 dirty 信号。
- **reuse** `MemoryDataSource` + `applyAutoAttach` 作为无文件起步的 HEAD 入口。
- **generalize** 原 `save()` / Manipulate `saveChanges` / 热修每命令 save 为
  单一 `commitScene`。
- **pattern** sketch：working model + history；Frame 仅边界。

## Files to create or modify

- `stage/src/app.ts` — `commitScene` / `discardScene`
- `stage/src/mode/edit.ts` — 去掉自动 save；finish 驻留
- `stage/src/mode/manipulate.ts` — 统一 API；finish 不静默 discard
- `stage/src/mode/base.ts` — 如需暴露 discard 辅助
- `stage/src/index.ts` — 导出若需要
- `stage/tests/app_save_edit_source.test.ts` → 改名/更新为 commitScene
- `page/src/ui/layout/LeftSidebar.tsx` 或 analysis 子组件 — dirty 提示
- `page/src/ui/layout/analysis/*` — Run 禁用当 dirty
- `page/src/App.tsx` / `MolvisWrapper.tsx` / file-load — destructive 门闩
- `page/src/components/*` — 未保存确认对话框（可新文件）
- `vsc-ext/src/webview/controller.ts` — `commitScene`
- `regressions/` 可选硬编码场景

## Tasks

- [x] Rename `save` → `commitScene`; add `discardScene`; keep thin `save()` alias
- [x] Remove per-command auto-save from EditMode; finish parks working tree
- [x] Wire Manipulate Save/Discard/Ctrl+S/finish to commitScene/discardScene (no silent wipe on finish)
- [x] Update stage unit tests for commit/discard and no auto-commit on command
- [x] Analysis UI: dirty prompt + disable Run; empty vs dirty states
- [x] Destructive load/reset gate: Save / Don't save / Cancel when dirty
- [x] Update vsc-ext triggerSave → commitScene
- [x] Run stage + page targeted tests

## Testing strategy

- Unit: empty app → seed edit pool → `commitScene` → `frameHasStructure` true +
  MemoryDataSource present；第二次 commit 不重复 DS。
- Unit: dirty after edit meta；`discardScene` 恢复到 commit 前 HEAD 原子数。
- Unit/行为：命令执行后 `hasUnsavedChanges` true 且 system.frame 未变直至
  `commitScene`。
- Page：dirty 时 analysis 展示保存提示且 Run disabled（组件或 hook 测试若可行）。

## Out of scope

- 抽取独立 3D MoleculeGraph 层。
- 改 sketch 包 history。
- 多帧轨迹编辑 commit 策略（仍只替换 current frame）。
- Collaborative / CRDT undo。
