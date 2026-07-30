---
status: code-complete
slug: shared-element-picker-01-core
created: 2026-07-30
grilled: true
---

# shared-element-picker-01-core

## Summary

在共享 `core` 包中提供完整的 118 元素周期表元数据和唯一的、无框架
`<molvis-element-picker>` Web Component。它像原生颜色输入一样暴露受控值、
禁用态和输入事件，供 Sketch、Stage 及其宿主直接复用。

## Domain basis

现有 `PeriodicTable` 是元素名称和半径的唯一数据源。本规格只补充稳定的原子序数、
周期、族、区块及可视网格坐标，不引入新的物理模型。

## Design

- 保留 `IElement` / `PeriodicTable` 兼容表；新增只读
  `PeriodicTableElement` 与按原子序数排序的 `PeriodicTableElements`，包含
  `atomicNumber`、`period`、`group`、`block`、`row`、`column`。
- `MolvisElementPickerElement` 原生继承 `HTMLElement`，Shadow DOM 独占触发器、
  完整周期表弹层、样式与键盘焦点。`compact` 属性提供工具栏尺寸。
- `value` 与 `disabled` 同时支持属性和 property；符号通过
  `normalizeElement` 归一化并验证；无效值抛出描述性 `TypeError` 并保留前值。
  用户选择依次派发 bubbles + composed 的 `input` 和 `change` 事件，消费方从
  `event.currentTarget.value` 读取值。
- 弹层使用浏览器原生 popover 行为处理 Escape 与外部点击；方向键在周期表格中
  移动焦点，Enter/Space 选择。
- `defineMolvisElementPicker(tag = "molvis-element-picker")` 采用
  `customElements.get()` 幂等注册。组件只从明确的 `./element-picker`
  子路径导出；默认 core barrel 不导入或注册 DOM。
- Shadow DOM 使用继承的 `--molvis-*` 变量并提供独立 fallback，消费者不复制样式。

### Reuse decision

- generalize `IElement` / `PeriodicTable`：由同一文件派生布局目录，不再建立 UI 数据表。
- reuse `normalizeElement`：统一外部 value 的大小写。
- pattern `MolvisViewerElement` / `defineMolvisViewer`：沿用原生生命周期、
  属性同步、composed 事件与显式幂等注册约定。

## Files to create or modify

- `core/src/elements.ts`
- `core/src/element_picker.ts` (new)
- `core/tests/elements.test.ts`
- `core/tests/element_picker.test.ts` (new)
- `core/package.json`
- `core/README.md`
- `regressions/shared-element-picker-01-core.test.ts` (new)

## Tasks

- [x] Write failing unit tests for periodic-table layout metadata in `core/tests/elements.test.ts`
- [x] Generalize `PeriodicTable` into `PeriodicTableElements` in `core/src/elements.ts`
- [x] Write failing unit tests for `MolvisElementPickerElement` in `core/tests/element_picker.test.ts`
- [x] Implement `MolvisElementPickerElement` and `defineMolvisElementPicker` in `core/src/element_picker.ts`
- [x] Export `./element-picker` in `core/package.json` and document the explicit registration API in `core/README.md`
- [x] Add regression example `regressions/shared-element-picker-01-core.test.ts` with hard-coded H/C/La/Og positions and Fe selection
- [x] Run full check + test suite

## Testing strategy

- 元数据测试固定验证 118 个唯一元素、连续原子序数以及 H、C、La、Og 的网格坐标。
- Web Component 浏览器测试分别验证属性/property 同步、禁用态、幂等注册、
  完整 118 单元格、键盘选择及 bubbles + composed 事件。
- 公共回归从 `@molcrafts/molvis-core/element-picker` 注册组件，选择 Fe 后固定期望
  `value === "Fe"`，并验证 H/C/La/Og 的硬编码坐标。

## Out of scope

- React 包装组件、Sketch/Stage 编辑状态、CPK 配色与元素属性百科。
- 默认 core barrel 自动注册自定义元素。
