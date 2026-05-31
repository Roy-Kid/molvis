---
title: Multi-source overlay UI — CombineSystems config panel (page)
status: code-complete
created: 2026-05-30
---

# Multi-source overlay UI — CombineSystems config panel (page)

## Summary

为 `page/src` 的 Pipeline 标签页新增一套 React 配置界面，让用户在侧边栏里驱动多源叠加功能（multi-source overlay）。用户可以新增一个 `CombineSystemsModifier`，勾选它要引用的分支（其它 modifier / 数据源，按 id），开关结构对齐（alignment）并选择参考分支、对应关系与质量加权，读取每个分支相对参考分支的 RMSD（来自 spec 03 的 modifier 状态），以及切换「按来源着色」（color-by-source，spec 04 模式）。本子规格只负责页面 UI，不触碰任何核心引擎逻辑——spec 01–04 已落地并拥有引擎侧实现，本 UI 仅通过既有的 `app.modifierPipeline` API、`pipeline.set_references` RPC（spec 02）与既有事件钩子读写状态。

## Domain basis

纯前端面板，无物理计算。RMSD 数值与对齐结果均由 `CombineSystemsModifier`（spec 03）计算并暴露为只读状态；UI 只做格式化展示（保留 3 位小数 + `Å` 单位、等宽数字）。分支引用的合法性（去自引用、去环）由引擎在 `set_references` 时强制校验（spec 02）；UI 在客户端做一层预过滤/禁用以减少无效操作，但不作为权威校验，引擎拒绝时优雅回退。

## Design

沿用现有 modifier-config 模式（不发明新容器）：

- **面板归属**：`CombineSystemsModifier` 的配置面板复用既有 per-modifier 属性面板机制。在 `ModifierProperties.tsx` 的 `instanceof` 分派链中新增一支，命中 `CombineSystemsModifier` 时渲染新组件 `CombineSystemsModifier`（page 侧）；它显示在 `PipelinePropertiesPane`（用户在 `PipelineList` 选中该 modifier 时）。新增动作走既有 `PipelineList` 的「Add」下拉——只要核心在 `ModifierRegistry` 注册了 `CombineSystemsModifier`（spec 01–03 拥有注册），下拉会自动出现该条目，本子规格无需改 `PipelineList` 的新增逻辑。

- **分支选择器 (branch picker)**：多选既有 modifier / 数据源 id 的列表。每行显示 NATO 显示名（`Alpha`/`Bravo`…，来自 `nato_ids.ts`）+ modifier 名称，并附 `text-[9px]` 的原始 id。候选集 = 当前 pipeline 中所有 modifier，排除自身、以及任何会形成环的分支（用 `tree_utils` 现有 parent 关系 + 引擎拒绝集计算）。无效项 disabled 并带 `title` 说明。勾选/取消调用 `app.modifierPipeline` 上的 `setReferences(id, ids[])`（映射 spec 02 的 `pipeline.set_references` RPC）；引擎拒绝（返回 falsy / 抛错）时不更新本地视图并显示 `text-destructive` + `AlertCircle` 状态行。

- **对齐控件 (alignment controls)**：`alignment ON/OFF` 复选框；参考分支 `Select`（候选仅限当前已引用的分支）；对应关系 `Select`（`Identical topology`（默认）/ `Selection subset`）；`mass-weighting` 复选框。关闭 alignment 时隐藏其余对齐子控件。每项写回 `CombineSystemsModifier` 的对应属性并触发 `app.applyPipeline({ fullRebuild: true })` + `onUpdate()`，与现有 modifier-config 组件一致。

- **RMSD 读出**：从 `CombineSystemsModifier` 的只读状态（spec 03）读取 per-branch RMSD-to-reference，以状态行样式渲染（`flex items-center gap-1 px-2 py-1`，`text-[10px] text-muted-foreground`，数字 `font-mono`，3 位小数 + `Å`）。参考分支自身显示 `—`。无对齐 / 未计算时显示短提示。

- **按来源着色 (color-by-source)**：在面板内放一个 `color-by-source` 复选框，写回 spec 04 暴露的着色模式开关（经 `CombineSystemsModifier` 或既有 color 接口，依 spec 04 落地的属性名）。附一个简短的来源→颜色图例（legend），把分支 NATO 名映射到调色板颜色（纯函数 `buildSourceLegend`）。

- **状态来源**：组件不持有权威状态。引用集、对齐参数、RMSD 全部从 `modifier` 实例 + `app` 读取；刷新依赖既有 `usePipelineTabState` 的 `onUpdate` 回调与 pipeline 事件（`MODIFIER_ADDED/REMOVED/REORDERED`）、以及 `frame-rendered` / `history-change`（RMSD 在重渲后更新）。新增一个轻量 `useCombineSystemsState(app, modifier)` 钩子订阅 `frame-rendered` 以刷新 RMSD 读出，卸载时退订。

- **纯函数抽取**：为可单测的 UI 逻辑抽出无 React 依赖的纯函数到 `combine_systems_logic.ts`：`getReferenceableBranches(self, allModifiers, rejectedIds)`（去自引用/去环过滤）、`formatRmsd(value | null)`（`"1.234 Å"` / `"—"`）、`buildSourceLegend(branchIds, palette)`（id→`{label, color}`）。组件只做渲染 + 事件绑定。

- **vsc-ext 影响**：`page/src` 由 vsc-ext webview 直接打包（见 CLAUDE.md / MEMORY 双打包规则），本面板纯 React + 既有 shadcn 组件，无新增 loader/define/alias，故 vsc-ext 无需改动；仅需保证不引入仅浏览器可用的全局。无额外工作项。

设计严格遵循 CLAUDE.md「Sidebar UI Design Language」：`text-[10px]` 大写区段标题、`text-xs` 输入/按钮、`h-7` 主控件、`h-6` 嵌套 tab（若用）、`text-muted-foreground` 表示非活动、前缀标签 `w-10 shrink-0 text-[10px]`、状态行 `flex items-center gap-1 px-2 py-1` + 前导图标 + 短祈使句，复用 Radix/shadcn `Select`/`Checkbox`/`Button`，不使用 `h-9`/`text-sm` 默认尺寸。

## Files to create or modify

- `page/src/ui/modes/view/modifiers/CombineSystemsModifier.tsx` (new) — 配置面板组件（分支选择器、对齐控件、RMSD 读出、color-by-source 切换 + 图例）。
- `page/src/ui/modes/view/modifiers/combine_systems_logic.ts` (new) — 纯函数：`getReferenceableBranches`、`formatRmsd`、`buildSourceLegend`。
- `page/src/ui/modes/view/modifiers/useCombineSystemsState.ts` (new) — 订阅 `frame-rendered` 刷新 RMSD 读出的轻量钩子。
- `page/src/ui/modes/view/ModifierProperties.tsx` — 在 `instanceof` 分派链新增 `CombineSystemsModifier` 一支，渲染新面板组件。
- `page/tests/combine_systems_logic.test.ts` (new) — 纯函数单元测试。

## Tasks

- [x] Write failing tests for branch-filter / RMSD-format / legend logic (page/tests/combine_systems_logic.test.ts)
- [x] Implement getReferenceableBranches, formatRmsd, buildSourceLegend in page/src/ui/modes/view/modifiers/combine_systems_logic.ts
- [x] Implement useCombineSystemsState hook in page/src/ui/modes/view/modifiers/useCombineSystemsState.ts
- [x] Implement CombineSystemsModifier panel in page/src/ui/modes/view/modifiers/CombineSystemsModifier.tsx (branch picker, alignment controls, RMSD readout, color-by-source toggle + legend)
- [x] Wire CombineSystemsModifier into the instanceof dispatch in page/src/ui/modes/view/ModifierProperties.tsx
- [x] Run full check + test suite

## Testing strategy

- Happy path（单元，纯函数）：`getReferenceableBranches` 返回排除自身后的候选集；`formatRmsd(1.2345)` → `"1.234 Å"`；`buildSourceLegend` 把分支 id 列表映射为稳定的 `{label, color}` 数组。
- Edge cases（单元，纯函数）：`getReferenceableBranches` 排除会成环的分支与 `rejectedIds`；`formatRmsd(null)` → `"—"`、`formatRmsd(0)` → `"0.000 Å"`；`buildSourceLegend([])` → `[]`；调色板少于分支数时颜色循环 / 稳定回退。
- UI runtime（`/mol:web` 验证，不写 E2E/Playwright）：在已加载 ≥2 个源的 pipeline 中新增 `CombineSystemsModifier` 并选中后，面板在 `PipelinePropertiesPane` 渲染；勾选一个分支会触发 `setReferences`（引用反映在面板）；打开 alignment + 选参考分支后，每个非参考分支显示 RMSD（`x.xxx Å`、等宽）；引擎拒绝成环引用时显示 `text-destructive` 状态行而非崩溃；切换 color-by-source 改变画布配色并显示图例。
- 项目规则：不为本 UI 写 E2E / Playwright；逻辑用纯函数单测覆盖，运行时行为交由 `/mol:web`。

## Out of scope

- 任何核心引擎逻辑：`CombineSystemsModifier` 本体、`referencedIds`、对齐 / RMSD 计算、color-by-source 计算（spec 01–04 拥有）。
- `pipeline.set_references` 的 RPC handler 实现（spec 02 拥有）；本 UI 只调用既有客户端 API。
- VSCode 扩展特有 UI（`page/src` 是共享前端，vsc-ext 直接打包；无需 vsc-ext 改动）。
- 通用 >2 结构的 Procrustes 对齐 UI。
- sequence / MCS 对应关系 UI（仅 Identical topology / Selection subset）。
- 修改 `PipelineList` 的新增菜单逻辑（注册由核心负责，菜单自动列出）。
