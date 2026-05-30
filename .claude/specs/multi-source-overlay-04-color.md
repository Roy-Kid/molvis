---
title: Color atoms by source via categorical ColorByProperty mode
status: code-complete
created: 2026-05-30
---

# Color atoms by source via categorical ColorByProperty mode

## Summary

在多源叠加（multi-source overlay）中，03-combine 已经向 atoms block 注入了逐原子的 `source_id`（I32，取值为分支序号 0..k-1）。本子规范让每个被叠加的来源在画面上 **视觉可区分**：按 `source_id` 给原子上色，每个不同的 `source_id` 映射到分类调色板中一个固定且确定的颜色。用户可以在「按元素上色」与「按来源上色」之间切换，二者互斥；当帧中不存在 `source_id` 列（单一来源、未做 combine）时，该上色不适用，回退为默认元素/类型上色。

## Domain basis

这是分类颜色映射（categorical color mapping），不涉及物理。映射规则：

- 取 `source_id` 的所有不同序号值，按自然序排序得到有序键列表 `k_0 < k_1 < ... < k_{m-1}`。
- 第 `j` 个不同序号映射到调色板第 `j mod N` 个颜色（`N` = 调色板长度），因此映射对给定 `source_id` 集合是确定的（deterministic by ordinal），且当来源数超过 `N` 时颜色按模循环（palette cycling）。
- 默认分类调色板为 `glasbey-vivid`（256 色，最大化相邻色的感知差异），即 `DEFAULT_CATEGORICAL_COLOR_MAP`。
- 颜色以线性 RGB 写入 `__color_r/g/b` 覆盖列，与现有 `ColorByPropertyModifier` 的字符串分类路径完全一致。

复用的现有机制：`buildCategoricalColorLookup`（`core/src/artist/palette.ts`）已实现「不同键去重 → 自然序排序 → 第 i 个键取 palette[i % N] → 超出 N 时告警并循环」的全部逻辑。

## Design

**复用判定（reuse vs new）：复用并扩展现有 `ColorByPropertyModifier`，不新增 modifier。**

理由：`ColorByPropertyModifier` 已经是「按任意逐原子列上色」的机制，并且字符串列已走分类调色板路径（`buildCategoricalColorLookup`）。唯一的缺口是：`source_id` 是 `I32` 列，现有代码把所有数值列（F64/U32/I32）送进 viridis **连续渐变** ramp，得到的是渐变而非分类 hue。新增一个独立 `ColorBySourceModifier` 会与现有分类逻辑、`__color_r/g/b` 注入、`buildAtomBuffers` 读取路径重复。最小且正确的改动是给 `ColorByPropertyModifier` 增加一个「把数值列当作分类列处理」的模式，让 `source_id` 的整数值走 `buildCategoricalColorLookup`（把每个整数 `stringify` 成键）。

**实体改动：**

- `ColorByPropertyModifier` 增加 `categorical: boolean` 配置（默认 `false`，保持现有数值列 → viridis 行为不变）。当 `categorical === true` 且列为数值（I32/U32/F64）时，读出数值、`String(value)` 作为键、走 `buildCategoricalColorLookup`，注入 `__color_r/g/b`；字符串列已天然分类，`categorical` 对其为 no-op（仍走分类）。
- `getCacheKey()` 纳入 `categorical`，使模式切换正确触发重算。
- `inspect()` 不变（已能在 `availableColumns` 中列出 `source_id`，因其不以 `__` 开头）。

**Capability：维持 `TransformsData`，不引入 `Draws`。** 与现有 `ColorByPropertyModifier`/`AssignColorModifier` 一致——上色通过向 atoms block 注入 `__color_r/g/b` 列完成，由渲染侧的 `buildAtomBuffers` 消费；modifier 本身不直接写 GPU buffer，也不触碰 `ImpostorState`。

**Render-state ownership（项目硬约束）：** 颜色不写进 GPU `instanceColor` 作为唯一真相。来源→颜色的赋值规则完全由 `ColorByPropertyModifier` 的可序列化配置（`columnName="source_id"` + `categorical=true`）承载，该 modifier 存在于 pipeline 中，`DrawFrameCommand` 触发 pipeline 重算时会重新执行 `apply()`、重新注入 `__color_r/g/b`，因此每次重绘都重新应用。无需改 `StyleManager`：modifier 配置即持久化的渲染状态，重绘时由 pipeline 自动重放。

**「按元素」vs「按来源」互斥模式：** 由 `columnName` 单值字段天然保证互斥——`columnName="source_id"`（+`categorical=true`）即「按来源上色」；`columnName=""` 即关闭覆盖、回退默认元素/类型上色。两者不能同时生效，因为只有一个 `columnName`。用户/调用方通过设置 `columnName` 与 `categorical` 选择模式；选择即 modifier 配置，随 pipeline 持久化。

**`source_id` 缺失时：** 覆写 `isApplicable(frame)`，当 `columnName==="source_id"` 且 atoms block 无 `source_id` 列时返回 `false`（picker 中置灰、`apply()` 作为防御也直接返回 input，等价 no-op）。单一来源、未 combine 的场景自动回退默认上色。

**轻量 legend（可选，若 05 之前需要）：** 仅导出一个纯函数 `buildSourceColorLegend(sourceIds, palette)` → `Array<{ sourceId, hex }>`，逻辑在本规范单元测试覆盖；任何真正渲染到 UI 的部分留给 05，标记 ui_runtime。

## Files to create or modify

- `core/src/modifiers/ColorByPropertyModifier.ts` — 增加 `categorical` 配置 + 数值列分类路径 + `isApplicable` 覆写
- `core/src/artist/palette.ts` — 导出 `buildSourceColorLegend`（trivial source→color 列表），复用 `buildCategoricalColorLookup`
- `core/tests/modifiers/ColorByPropertyModifier.source.test.ts` (new) — source_id 分类映射、确定性、循环、isApplicable、缓存键测试
- `core/tests/artist/palette.legend.test.ts` (new) — `buildSourceColorLegend` 单元测试
- `.claude/notes/core-arch.md` — 一行：记录「按来源上色 = ColorByPropertyModifier categorical 模式 + source_id 列」的设计决策

## Tasks

- [x] Write failing tests for categorical numeric coloring in ColorByPropertyModifier (core/tests/modifiers/ColorByPropertyModifier.source.test.ts)
- [x] Write failing tests for buildSourceColorLegend (core/tests/artist/palette.legend.test.ts)
- [x] Implement categorical config + numeric-as-categorical path in ColorByPropertyModifier (core/src/modifiers/ColorByPropertyModifier.ts)
- [x] Implement isApplicable override for missing source_id column in ColorByPropertyModifier (core/src/modifiers/ColorByPropertyModifier.ts)
- [x] Implement buildSourceColorLegend in palette.ts reusing buildCategoricalColorLookup (core/src/artist/palette.ts)
- [x] Add TSDoc per doc.style documenting categorical mode, glasbey-vivid default palette, ordinal determinism, and >N cycling
- [x] Record color-by-source design decision in .claude/notes/core-arch.md
- [x] Run full check + test suite

## Testing strategy

Happy path (rstest, mock SceneIndex, no BabylonJS):

- 构造含 `source_id` I32 列（如 `[0,0,1,1,2]`）的 atoms block，`columnName="source_id"`、`categorical=true`，`apply()` 后断言 `__color_r/g/b` 已注入，且 `source_id===0` 的原子拿到与 `===1`、`===2` 不同的颜色三元组。
- 确定性：相同 `source_id` 集合两次 `apply()` 产出相同颜色；序号 `k_j` 取 palette 中第 `j mod N` 项（按自然序）。
- 调色板循环：`source_id` 不同值数量 > 调色板长度时，颜色按模循环且不抛错。

Edge cases:

- `isApplicable(frame)` 在 atoms block 无 `source_id` 列时返回 `false`；`apply()` 在此情形返回 input（no-op），不注入覆盖列。
- `categorical=false`（默认）时数值列仍走 viridis 渐变，行为不回归。
- 复用断言：字符串列在 `categorical=true/false` 下均走现有分类路径，无行为变化。
- `getCacheKey()` 在切换 `categorical` 时变化，触发重算。

Re-apply at draw (render-state ownership):

- 在同一 modifier 实例上连续两次 `apply()`（模拟一次重绘），断言第二次重新注入 `__color_r/g/b` 且颜色与第一次一致——证明颜色由 modifier 配置重放、而非靠 GPU buffer 残留。

Legend:

- `buildSourceColorLegend([0,1,2])` 返回 3 条 `{sourceId, hex}`，hex 与分类调色板序号一致。

Live-canvas (ui_runtime, /mol:web, sparingly): 实际画布上每个来源呈现可区分像素颜色 —— 仅作端到端肉眼确认，逻辑正确性由上述 core 单元测试承担。无 E2E/Playwright（项目规则）。

## Out of scope

- 03 的 combine modifier 与 `source_id` 列的产生（由 03-combine 提供）
- 02 reference edge、01 kernel
- 05 的 branch-picker UI 面板
- 连续/数值 colormap（本规范仅分类按来源；数值 viridis 路径保持不变，不在此扩展）
- 超出「trivial source→color 列表」的 legend（交互式图例、可点选高亮等留给 05）
- 改写 StyleManager 新增上色字段（按设计，modifier 配置即持久化渲染状态，无需 StyleManager 改动）
