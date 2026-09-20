---
title: page-host-init-single-path — init/applySettings 只留一条路径
status: approved
created: 2026-09-17
slug: page-host-init-single-path
scope_layer: page
---

# page-host-init-single-path — init/applySettings 只留一条路径

## Summary

`page/src/MolvisWrapper.tsx:544-577` 的 `handleHostMessage` 监听 window `message`，把 `init` / `applySettings` 里的 `config` / `settings` 应用到 `molvisRef.current`。`vsc-ext/src/webview/attachStageHost.ts:147-160` 的 `handleCore` 对**同一个** `Molvis` 实例做同一件事（`applyConfigAndSettings`）。两条路径、一个效果，且 origin 规则不对称：`MolvisWrapper` 卡 `event.origin !== window.location.origin`，`attachStageHost` 不卡——缺守卫的是**另一侧**。在 VS Code webview 中该 origin 条件成立，因此 page 面板**今天就在双重应用 config/settings**。

本 spec 删除 `MolvisWrapper` 一侧，让 `attachStageHost` 成为唯一路径。

**调查结论（推翻了先前两份评审共同持有的假设）**：先前 `one-viewer-surface-01/02` 的设计评审都判断这块债"受 standalone / notebook / python 宿主的隐含契约约束"，因此不可在链条内处置。**该契约不存在。** 全仓对 `"applySettings"` 的引用只有一处，就是 `MolvisWrapper.tsx:558` 这个消费者自己；`init`/`applySettings` 在 `vsc-ext/` 之外**没有任何生产者**（`page/src`、`src/`、`stage/src`、`core/src`、`python/` 全部为空）。`docs/` 中唯一提及在 `docs/interfaces/vscode/configuration.md:4`，属于 VS Code 界面文档，不是通用嵌入协议。因此：

- 对 standalone page、notebook、python WebSocket 宿主：该处理器**从未被触发**，删除零影响。
- 对 VS Code page 面板：`bootstrap.tsx` 已挂 `attachStageHost`（link 02 之后是 `attachPageHost`，仍经由它），删除后 `init`/`applySettings` 仍被应用，只是应用一次而非两次。

风险因此远低于先前评估：这是一次安全删除，不是跨包重构。

## Design

删除 `page/src/MolvisWrapper.tsx` 中的 `handleHostMessage` 定义、其 `window.addEventListener("message", handleHostMessage)` 注册、以及 cleanup 中对应的 `removeEventListener`。若删除后 `asObject` / `applyMolvisSettings` / `MolvisConfig` / `MolvisSetting` 在该文件内不再有其他使用者，一并清理其 import 与定义（由 biome 的未使用检查证实，不凭目测）。

**不**在 `attachStageHost` 侧补 origin 守卫：VS Code webview 的消息来源由 `acquireVsCodeApi` 通道与 CSP 约束，而 `attachStageHost` 的 `isHostMessage` 允许表已是该侧的过滤闸；再加一道 origin 判据会引入第二套规则，正是本 spec 要消灭的东西。若将来 page 需要在不可信 frame 中接收宿主消息，那是 `attachStageHost` 的一次显式设计，不是这里的残留。

## Files to create or modify

- `page/src/MolvisWrapper.tsx`
- `page/tests/MolvisWrapper.host-messages.test.tsx` (new)

## Tasks

- [ ] Write a failing unit test pinning that MolvisWrapper ignores window `init`/`applySettings` messages (page/tests/MolvisWrapper.host-messages.test.tsx)
- [ ] Delete handleHostMessage, its listener registration and its cleanup from page/src/MolvisWrapper.tsx, plus any imports it alone kept alive
- [ ] Run full check + test suite

## Testing strategy

- `page/tests/MolvisWrapper.host-messages.test.tsx`：挂载 `MolvisWrapper`，向 `window` 派发一条 `{ type: "applySettings", settings: … }` 消息，断言引擎设置**未**被改动——即 page 侧不再自行认领宿主消息。该测试在删除前是红的（今天的处理器会应用它），删除后转绿，因此被证明会咬人。
- vsc-ext 侧的「仍然应用一次」由 `one-viewer-surface-02` 的 ac-012 实机验证覆盖；本 spec 不重复造一个跨包闸。
- 交付闸：`npm run test:page` 零失败 + 全量 pre-commit。

## Out of scope

- 给 `attachStageHost` 补 origin 守卫（理由见 Design）。
- `FileFormat` / `LoadMode` 结构性再声明的未守卫漂移（另一份 spec）。
- 任何 `one-viewer-surface` 链条内的行为改动。
