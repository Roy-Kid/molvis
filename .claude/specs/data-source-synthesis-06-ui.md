---
title: Scene synthesis configuration panel (UI)
status: code-complete
created: 2026-05-31
---

# Scene synthesis configuration panel (UI)

## Summary

将原本"在管线里新增一个 CombineSystems modifier 节点 + 分支选择器"的交互，改写为"配置管线头部的场景合成步骤"。合成不再是某个 modifier 节点的属性，而是 `SceneSynthesisConfig` 这一场景级配置（由本链 04 引入、由 04/05 持有）。用户在 Pipeline 标签页里看到一个场景级的 Sources 合成面板（只要存在 ≥1 个启用的数据源就常驻显示），可在其中勾选参与合成的数据源、选择合成模式（extend / augment）、开关对齐（参考源 + 质量加权 + 子集）、以及开关 color-by-source 并查看图例。所有编辑写回 `SceneSynthesisConfig` 并触发 `applyPipeline({ fullRebuild: true })` 重建场景。

## Domain basis

纯 UI 改写，无新物理。沿用既有读数语义：每个非参考源相对参考源的 RMSD 以"3 位小数 + Å"显示（`formatRmsd`），color-by-source 图例颜色取自 core 的分类调色板序数（`buildSourceLegend` → `buildSourceColorLegend`），与画布上 spec-04 `ColorByPropertyModifier` 分类模式所用的 `source_id` 映射一致。

## Design

合成从"per-node modifier"上移为"场景级配置"，UI 随之从 `ModifierProperties` 的 instanceof 分发中移除，改为 Pipeline 标签页的常驻区段：

- **新面板 `SceneSynthesisPanel`**：渲染于 `PipelineTab` 内、`PipelineList` 之上的一个 `SidebarSection`（标题 "Sources"）。仅当存在 ≥1 个启用的 `DataSourceModifier` 时渲染，否则返回 `null`。面板内分区：
  - **数据源选择**：列出当前启用的数据源（来自 `app.modifierPipeline.getModifiers()` 过滤 `DataSourceModifier`，再按 `enabled` 过滤），每行 Checkbox 控制其是否参与合成。替代旧的"分支选择器"。
  - **模式**：`Select`（extend / augment），写回 `config.mode`。
  - **对齐**：Checkbox 启用 → 展开参考源 `Select`、Mass-weighted Checkbox、（可选 subset）；启用后逐源显示 RMSD 读数。
  - **Color by source**：Checkbox 开关 + 图例。开关复用 spec-04 的 `ColorByPropertyModifier`（categorical, `columnName === "source_id"`）的增删逻辑（沿用旧面板的 `toggleColorBySource` 实现），图例用 `buildSourceLegend`。
- **配置读写**：通过 spec-04 暴露的 app get/set 面板读写 `SceneSynthesisConfig`（输入约定为 `app.getSynthesisConfig()` / `app.setSynthesisConfig(next)`，按不可变更新返回新对象）。每次编辑后 `void app.applyPipeline({ fullRebuild: true })`。
- **RMSD 刷新**：`useSceneSynthesisState`（由 `useCombineSystemsState` 重命名/改造）订阅 `frame-rendered`，强制重读合成产生的 RMSD（来自 config-state / `synthesis_rmsd` meta，而非已删除的 modifier `rmsdByBranch`）。
- **纯逻辑模块**：`combine_systems_logic.ts` 重命名为 `scene_synthesis_logic.ts`。保留 `formatRmsd`、`buildSourceLegend`；删除 `getReferenceableBranches`（依赖已不存在的 `referencedIds`），代之以 `selectEnabledDataSources(modifiers)` —— 从 modifier 列表中筛出启用的 `DataSourceModifier`、映射为 `{ id, name }`。
- **移除分发**：`ModifierProperties.tsx` 删除 `CoreCombineSystemsModifier` import 与对应 instanceof 分支（class 在 04 已删除）。

入口/依赖（spec-04 提供，本 spec 消费，不在此实现）：`SceneSynthesisConfig` 类型、`app.getSynthesisConfig()` / `app.setSynthesisConfig()`、合成 RMSD 暴露面。

## Files to create or modify

- `page/src/ui/modes/view/modifiers/scene_synthesis_logic.ts` (new) — 由 `combine_systems_logic.ts` 重命名而来；保留 `formatRmsd`/`buildSourceLegend`，新增 `selectEnabledDataSources`，删除 `getReferenceableBranches`
- `page/src/ui/modes/view/modifiers/combine_systems_logic.ts` — 删除（被上文 new 文件取代）
- `page/src/ui/modes/view/pipeline/SceneSynthesisPanel.tsx` (new) — 场景级合成配置面板
- `page/src/ui/modes/view/pipeline/useSceneSynthesisState.ts` (new) — 由 `useCombineSystemsState.ts` 重命名/改造；订阅 `frame-rendered` 触发 RMSD 重读
- `page/src/ui/modes/view/modifiers/useCombineSystemsState.ts` — 删除
- `page/src/ui/modes/view/modifiers/CombineSystemsModifier.tsx` — 删除（per-node 面板已废弃）
- `page/src/ui/modes/view/ModifierProperties.tsx` — 移除 `CoreCombineSystemsModifier` import + instanceof 分支 + `CombineSystemsModifier` 组件 import
- `page/src/ui/modes/view/PipelineTab.tsx` — 在 `PipelineList` 之上挂载 `SceneSynthesisPanel`
- `page/tests/scene_synthesis_logic.test.ts` (new) — 由 `combine_systems_logic.test.ts` 重命名/改写：`formatRmsd`、`buildSourceLegend`、`selectEnabledDataSources` 的纯逻辑测试
- `page/tests/combine_systems_logic.test.ts` — 删除

## Tasks

- [x] Write failing tests for scene_synthesis_logic helpers (page/tests/scene_synthesis_logic.test.ts)
- [x] Implement scene_synthesis_logic.ts: keep formatRmsd/buildSourceLegend, add selectEnabledDataSources, remove getReferenceableBranches (page/src/ui/modes/view/modifiers/scene_synthesis_logic.ts); delete combine_systems_logic.ts and combine_systems_logic.test.ts
- [x] Implement useSceneSynthesisState reading synthesis RMSD on frame-rendered (page/src/ui/modes/view/pipeline/useSceneSynthesisState.ts); delete useCombineSystemsState.ts
- [x] Implement SceneSynthesisPanel with source list, mode, alignment, and color-by-source sections (page/src/ui/modes/view/pipeline/SceneSynthesisPanel.tsx)
- [x] Wire config edits to app.getSynthesisConfig/setSynthesisConfig + applyPipeline({ fullRebuild: true }) in SceneSynthesisPanel
- [x] Mount SceneSynthesisPanel above PipelineList in PipelineTab (page/src/ui/modes/view/PipelineTab.tsx)
- [x] Remove CombineSystemsModifier import, instanceof branch, and delete CombineSystemsModifier.tsx (page/src/ui/modes/view/ModifierProperties.tsx)
- [x] Run full check + test suite

## Testing strategy

- **Happy path (unit, page/tests)**: `selectEnabledDataSources` 返回启用的数据源 `{id,name}`、过滤掉禁用与非 `DataSourceModifier` 项；`formatRmsd` 3 位小数 + Å；`buildSourceLegend` 序数颜色与 core 调色板一致。
- **Edge cases (unit)**: `selectEnabledDataSources` 在空列表 / 全禁用 / 无数据源时返回 `[]`；`formatRmsd(null)` 与 `formatRmsd(NaN)` 返回 em dash；`buildSourceLegend([])` 返回 `[]` 且超过调色板长度时循环取色。
- **ui_runtime (owed to /mol:web)**: 加载 ≥1 数据源后 Sources 面板渲染，含源列表 + 模式 + 对齐 + color-by-source；勾选对齐后逐源显示 RMSD 读数；extend↔augment 切换触发场景重建（画布更新）；切换 color-by-source 时图例与画布配色一致。
- **No E2E/Playwright** —— 遵循项目 no-E2E-for-UI 规则；交互行为交由 /mol:web 的 ui_runtime 评估。

## Out of scope

- 引擎合成逻辑（02/03/04：`SceneSynthesisConfig` 类型、单一 System、reference-edge/CombineSystems 节点的删除、RMSD 计算）。
- RPC 表面（05）。
- color-by-source modifier 本体（`ColorByPropertyModifier` 分类模式，来自上一链，原样复用，不改动）。
- spec-04 的 app get/set 配置面板实现本身（本 spec 仅消费）。
