---
title: one-viewer-surface-04-surface-roundtrip — 宿主持有 surface，提升不再重建面板
status: approved
created: 2026-09-17
slug: one-viewer-surface-04-surface-roundtrip
chain: one-viewer-surface (link 4 of 5)
scope_layer: vsc-ext
---

# one-viewer-surface-04-surface-roundtrip — 宿主持有 surface，提升不再重建面板

## Summary

把 surface 的真值从 webview 本地搬到宿主，并让 `molvis.openInPage` 变成一条消息而不是「销毁面板 + 新建 Page」。

link 03 之后按钮已经能用，但是**纯本地翻转**：宿主不知道 chrome 被打开了，于是 (a) 标签标题仍写着 `Quick look:`，(b) 热重载或 `molvis.reload` 重放 `ready` 时会退回 `canvas`，(c) 宿主侧的 `molvis.openInPage` 仍在销毁重建。本环补上往返，宿主成为唯一写入者。

`setSurface` / `surfaceChanged` 在本环**同时**获得生产者与消费者——这正是它们被推到这一环的原因。

## Design

### 1. 往返的方向与唯一写入者

```
画布按钮 → onSurfaceChange → surfaceChanged（webview→host）
                                      ↓
                       宿主：存 surface、改标题、回发 setSurface
                                      ↓
        attachPageHost 的 onMessageSeen → hostSurfaceOf → setOpts({surface})
```

不会成环：`onSurfaceChange` 只由按钮的 `onClick` 触发，`setOpts` 不触发它。

这依赖 link 01 写进 `MountHostOpts.onSurfaceChange` JSDoc 的契约：宿主一旦提供该回调就接管真值，**必须**写回。本环 `bootstrap.tsx` 开始提供它，于是 link 03 里那条本地兜底（`mount.tsx:166-168`）在 VS Code 下不再生效——真值移交给宿主。兜底继续服务 standalone / notebook 宿主。

### 2. 协议

- `HostToWebviewMessage` 增 `{ type: "setSurface"; surface: PageSurface }`。
- `WebviewToHostMessage` 增 `{ type: "surfaceChanged"; surface: PageSurface }`。
- `hostSurfaceOf` 扩展为同时读 `init` 与 `setSurface`。
- `PAGE_HOST_MESSAGE_TYPES = [...QUICK_VIEW_HOST_MESSAGE_TYPES, "setSurface"] as const` + `isPageHostMessage`，复用 `isTypedHostMessage`。**`attachPageHost` 必须传 `isHostMessage: isPageHostMessage`**——这是本环最容易静默失败的一点：不传就会在 `onWindowMessage` 里被默认的 Quick look 闸门丢掉，早于 `onMessageSeen`，表现为「消息发了但什么都没发生」。两张表不得合流，由单测钉死。

link 02 曾删掉这张表，因为那时它与 Quick look 表逐字相同、测试是同义反复。现在它真有一个新成员，这不是走回头路。

### 3. 面板拥有 surface 与标题，宿主不得从外部写标题

`previewPanel.ts:67` 把 `baseTitle = panel.title` 在构造时捕获，并在每次 `dirtyStateChanged` 重设（`:94`）。因此**任何来自 `activate.ts` 的标题写入都会在场景第一次变脏时被静默回滚**。

修法是面板自己拥有这两样：panel-local 的 `surface`、`baseTitle`、`isDirty`，加一个 `applyTitle()`。`WebviewPanelMeta` 增 `setSurface?: (surface: PageSurface) => void` —— **一个回调，不是可变字段**。可变字段会让 `activate.ts`、面板的消息处理器、`panelRegistry` 三方共写一个描述性结构，属于被禁的跨模块隐式状态；回调让所有权留在面板里。

面板的 `case "ready"` 改用 `createInitMessage(surface)`，于是重放（hot reload、`molvis.reload`）会**保留**已提升的状态而不是静默降级。面板的 `case "surfaceChanged"` 调用同一个 `setSurface`，所以用户点按钮和宿主发命令走完全同一条路径。

关于重放范围的诚实记账：`createHotReloadWatcher` 只在 `extensionMode !== Production` 时注册（`activate.ts:428-430`），生产环境唯一的重放是 `molvis.reload`（`:419-427`）。所以这条修正在开发时天天生效，在生产里只影响 reload 命令——不是普遍性的正确性论证。

### 4. `molvis.openInPage` 的两条路径

- 活动面板是**本扩展的 webview 面板**（经 `panelRegistry` 查到 `setSurface`）→ 调用它，不销毁、不重读。
- 活动面板是自定义编辑器（`molvis.editor` / `molvis.binaryEditor`，本环未迁移）→ 保留今天的 dispose + 新建 Page。**过渡状态**，随 link 05 迁移那两个编辑器一并消失。

### 5. 提升后的面板归属——否则会开出第二个 page webview

提升是原地发生的，面板仍只记在 `activeQuickView`，`activePage` 仍是 `undefined`。于是下一次 `molvis.openPage` 看不到已有的 page 表面，**再开一个 ~10.6 MB 的 webview**，并绕过 `:157-171` 那段「同文件已开则 reveal 而不是重载」的守卫——那段注释恰好写着这笔开销。

修法：提升时把面板移入 `activePage` / `activePageUri` 并清掉 `activeQuickView`；Quick look 既有的 `onDidDispose` 同时清理这两处。

## Files to create or modify

- `vsc-ext/src/protocol/messages.ts`、`vsc-ext/src/protocol/index.ts`
- `vsc-ext/src/webview/attachPageHost.ts`
- `vsc-ext/src/page/bootstrap.tsx`
- `vsc-ext/src/extension/types.ts`
- `vsc-ext/src/extension/panels/previewPanel.ts`
- `vsc-ext/src/extension/panels/pagePanel.ts`
- `vsc-ext/src/extension/activate.ts`
- `vsc-ext/src/extension/panels/html.ts`（bump）
- `vsc-ext/tests/unit/protocol/messages.test.ts`

## Tasks

- [ ] Write failing unit tests for the page allow-list and setSurface decoding
- [ ] Implement setSurface, surfaceChanged, PAGE_HOST_MESSAGE_TYPES and isPageHostMessage, extend hostSurfaceOf, re-export from the barrel
- [ ] Pass isHostMessage: isPageHostMessage from attachPageHost
- [ ] Post surfaceChanged from bootstrap.tsx onSurfaceChange
- [ ] Give previewPanel and pagePanel panel-owned surface plus title, expose setSurface on WebviewPanelMeta, and send the stored surface on ready
- [ ] Rewrite molvis.openInPage to call the panel's setSurface for webview panels, keeping the custom-editor path
- [ ] Move a promoted panel into the activePage tracker and clear it on dispose
- [ ] Bump WEBVIEW_ASSET_REV
- [ ] Verify live: promote keeps the scene, retitles the tab, survives molvis.reload, and does not open a second Page
- [ ] Run full check + test suite

## Testing strategy

- `vsc-ext/tests/unit/protocol/messages.test.ts`（node/mocha，唯一可单测的一层）
  - `PAGE_HOST_MESSAGE_TYPES` 排序后逐字等于 10 项（含 `setSurface`）。
  - `isPageHostMessage` 接受 `setSurface`；`isQuickViewHostMessage` 对同一条为**假**。
  - `hostSurfaceOf` 对 `setSurface` 与 `init` 各返回对应值；无字段 / 未知值 / 其他类型返回 `null`。
  - 既有 `QUICK_VIEW_HOST_MESSAGE_TYPES` 逐字断言一字不改仍绿。
- 面板与 `activate.ts` 导入 `vscode` 值，node/mocha 不可加载；守卫是 typecheck、上述单测、实机验证。
- 实机验证逐条列于 Tasks 第 9 项，必须逐条核对。
- 不新增 `regressions/` 脚本（lane 条文矛盾待裁定）。

## Out of scope

- **`molvis.openInPage` 在已提升的面板上仍然可见**（`package.json:398`、`:309` 的 `when` 按 viewType 判断，而 viewType 不变）。按下去会重发 `setSurface("full")`，被面板的 `if (next === surface) return` 吞掉——无害但是个误导性的可用状态。加一个 context key 需要跟踪面板焦点，易失准；本环选择**记名不修**，留给 link 05 随 `when` 子句一并处理。
- 迁移 `stagePanel.ts` / `editorProvider.ts` / `binaryEditorProvider.ts`，退役 `getPreviewHtml` / `webview/index.ts` / `controller.ts` / `attachQuickViewHost.ts`——link 05。
- `molvis.defaultViewer` 语义、四份文档、`notes.md` 的改写——link 05。
- `page-host-init-single-path`（已立 spec）。本环让 Quick look 这个最高流量表面继续跑在那条分叉的送达路径上。
- `enableCapability` / `disableCapability` 至今无宿主生产者——记名。
