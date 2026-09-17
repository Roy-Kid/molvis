---
title: one-viewer-surface-05-editors-and-truth — 自定义编辑器迁移，并把文档说法改成真的
status: approved
created: 2026-09-17
slug: one-viewer-surface-05-editors-and-truth
chain: one-viewer-surface (link 5 of 5)
scope_layer: vsc-ext + docs + notes
---

# one-viewer-surface-05-editors-and-truth — 自定义编辑器迁移，并把文档说法改成真的

## Summary

收尾。两件事：把两个自定义编辑器搬到统一表面，以及把仓里所有「提升会重新加载文件」的说法改成真的——那句话现在**显示在 VS Code 的设置界面上**，是对用户说谎。

**不迁移 `stagePanel.ts`，也不退役 stage bundle。** 这不是遗漏，是一个**需要操作者决定的产品问题**，本 spec 不替他决定（见 Out of scope）。因此 `getPreviewHtml`、`webview/index.ts`、`controller.ts`、`attachQuickViewHost.ts` 与 `rslib.webview.config.mts` 的 webview 入口全部仍是活的，不产生孤儿。

## Design

### 1. 两个自定义编辑器改用统一表面

`editorProvider.ts`（文本文档编辑器）与 `binaryEditorProvider.ts`（只读字节查看器）的 `getPreviewHtml` 换成 `getPageHtml(webview, uri, { surface: "canvas" })`。它们的行为与今天一致（只有 stage 自己的 HUD），额外得到画布上的「Show controls」——从一个文件编辑器里直接打开完整界面，正是本链条要的形状。

**`editorProvider` 的去抖重载不构成问题（已实测，推翻先前两次评审的判断）。** 那两次评审都担心它 300ms 去抖的 `onDidChangeTextDocument` → `loadTextDocumentToWebview`（`:122-131`）会撞上 page 外壳的未保存场景提示。实测：`sceneHasUnsavedEdits` 只在 `page/src/MolvisWrapper.tsx:266` 与 `:320` 被查，都是该组件自己的拖放/排队路径；`attachStageHost` 的 `case "loadFile"` 从不查它。宿主驱动的加载因此绕过提示，与今天用 stage bundle 时逐字相同。不欠决定。

`binaryEditorProvider` 是纯机械替换（只读，字节/STL/mrec 路径已走 `attachStageHost`，而 `attachPageHost` 包着它）。

### 2. `molvis.defaultViewer` —— 重新定义，不退役

现在的 `markdownDescription`（`vsc-ext/package.json:449`）写着：

> `page` skips the Quick look step entirely — useful because promoting a Quick look to the Page reloads the file (the two tabs are separate webviews and cannot share a parsed frame, so on Remote-SSH the payload crosses the connection twice).

**整句话已经不成立**：提升是同一个 webview 里的一条消息。但这个设置本身仍然有意义——它现在表达的是「文件打开时 chrome 开还是关」，这是真实的偏好。因此**保留 enum 值 `quickLook` / `page` 不变**（改名会让用户已有的设置失效），只改写描述。

`vsc-ext/tests/unit/extension/manifest.test.ts:138` 的测试名 "defaultViewer lets a user skip the reload that promoting costs" 编码了同一个已死的理由，改为陈述新语义；断言本身（enum 两值、默认 `quickLook`）仍然成立，保留。

### 3. 文档

`docs/interfaces/vscode/` 下凡是说「Quick look 与 Page 是两个表面 / 提升会重载」的地方改写为「同一个查看器，chrome 可开可关」。至少涉及 `quick-view.md`、`configuration.md`、`index.md`、`remote.md`——实现时以全文搜索为准，不以本清单为准。

### 4. `notes.md` 的规则改写

`notes.md` 记着「两个 webview 无法共享已解析的 frame」。**约束仍然成立**（frame 在 wasm 线性内存里，确实过不去），但由它推出的结论「提升必然重载」不再成立——因为不再有第二个 webview。改写为：约束照旧 + 推论换成「所以提升不得新建 webview」。

### 5. 04 遗留的 `when` 子句

link 04 记名未修：`molvis.openInPage` 在已提升的面板上仍然可见（`package.json:398`、`:309` 按 viewType 判断，而 viewType 不变）。本环因为本来就要动这些 `when`，一并处置：加 context key `molvis.activeSurfaceIsCanvas`，在面板 surface 变化与焦点变化时设置，`when` 追加该键。若实现时发现焦点跟踪不可靠，**改为在 spec 中降级记名并说明**，不得留一个时对时错的 `when`。

## Files to create or modify

- `vsc-ext/src/extension/panels/editorProvider.ts`
- `vsc-ext/src/extension/panels/binaryEditorProvider.ts`
- `vsc-ext/src/extension/activate.ts`、`vsc-ext/src/extension/panels/previewPanel.ts`（context key）
- `vsc-ext/package.json`（`defaultViewer` 描述、`when` 子句）
- `vsc-ext/src/extension/panels/html.ts`（bump）
- `vsc-ext/tests/unit/extension/manifest.test.ts`
- `docs/interfaces/vscode/*.md`
- `.claude/notes/notes.md`

## Tasks

- [ ] Serve getPageHtml with surface "canvas" from binaryEditorProvider.ts
- [ ] Serve getPageHtml with surface "canvas" from editorProvider.ts
- [ ] Redefine molvis.defaultViewer's description as chrome off/on and update the manifest test's name and rationale
- [ ] Add the active-surface context key and gate molvis.openInPage's when clauses on it, or record why focus tracking makes that unreliable
- [ ] Rewrite the docs that describe Quick look and the Page as two surfaces
- [ ] Rewrite the notes.md rule so the constraint stays and the dead consequence goes
- [ ] Bump WEBVIEW_ASSET_REV
- [ ] Verify live: both editors open chrome-off and promote in place; the settings UI text is true
- [ ] Run full check + test suite

## Testing strategy

- `vsc-ext/tests/unit/extension/manifest.test.ts`：`defaultViewer` 仍贡献、enum 两值、默认 `quickLook`；描述**不得**再包含 `reload`（这条会咬人：把旧描述放回去就红）。
- `vsc-ext/tests/unit/extension/webviewBundle.test.ts` 与 `binaryEditorRange.test.ts` 既有断言保持绿（后者只断言 `previewPanel.ts` 含 `handleRangeMessage`，本环不动它）。
- 编辑器 provider 导入 `vscode` 值，node/mocha 不可加载；守卫是 typecheck 与实机验证。
- 文档与 notes 无自动闸——由 review 承担，这一点明说，不假装有闸。
- 不新增 `regressions/` 脚本（lane 条文矛盾待裁定）。

## Out of scope

- **`stagePanel.ts` / `molvis.stage` 视图类型的去留——留给操作者决定，本 spec 不代决。** 理由：统一之后 `molvis.stage` 与 `molvis.page` 除了 viewType 与标题之外没有区别（若迁移为 `surface: "full"`），或者变成第二个 Quick look（若迁移为 `"canvas"`）。两种选择都会移除或改变一个用户每天用的顶层命令、一个活动栏视图和三处 `when` 子句，这是产品决定而不是重构。选项：
  - **A** 退役 `molvis.stage`，`molvis.openStage` 成为 `molvis.openPage` 的别名。最干净，但删掉一个命令。
  - **B** `stagePanel` 迁移为 `surface: "full"`，`molvis.stage` 作为「直接打开完整界面」的入口保留。
  - **C** 保持现状，stage bundle 长期并存。
  在裁定之前，stage bundle（~8.2 MB）继续留在 VSIX 里。
- 退役 `getPreviewHtml` / `webview/index.ts` / `controller.ts` / `attachQuickViewHost.ts` 与 `rslib.webview.config.mts` 入口——取决于上面的裁定。
- `page-host-init-single-path`（已立 spec，未实现）。
- `enableCapability` / `disableCapability` 无宿主生产者——记名。
- `canvasOnly` god-predicate 的分解（link 01 记名）。
- `regressions/` lane 条文矛盾（`notes.md` 已记名，待裁定）。
