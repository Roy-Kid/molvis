---
status: code-complete
slug: shared-element-picker-03-page
created: 2026-07-30
grilled: true
---

# shared-element-picker-03-page

## Summary

在产品页的 2D `MolvisSketch` 与 3D `ToolsTab` 中嵌入同一个 core Web
Component，删除两份本地元素清单；两处分别薄接既有 SketchBoard 与 EditMode 状态。

## Domain basis

page 是 Sketch 与 Stage 的共同宿主；它只负责把共享输入事件转交给各引擎。

## Design

- 一个 page 内部注册模块调用 `defineMolvisElementPicker()`；两处消费方仅渲染
  `<molvis-element-picker>`，不创建 React picker。
- JSX 声明把自定义元素类型绑定到 `MolvisElementPickerElement`，使 `onInput`
  的 currentTarget 可读取强类型 `value`。
- `MolvisSketch` 使用 compact 触发器并将输入交给 `SketchBoard.setElement()`；
  board 快捷键变更会回写 picker value。
- `ToolsTab` 使用普通触发器并把输入交给现有 `updateEditMode({ element })`。
- 删除 `ELEMENTS` 与 `COMMON_ELEMENTS`；Web Component 的 Shadow DOM 是唯一 UI。

### Reuse decision

- generalize `MolvisSketch.ELEMENTS` 与 `ToolsTab.COMMON_ELEMENTS`：统一替换为 core picker。
- reuse `SketchBoard.setElement` 与 `updateEditMode`：保持引擎状态入口不变。
- pattern 原生颜色输入：沿用 `value`、`disabled`、`input` 的消费方式。

## Files to create or modify

- `page/src/ui/modes/edit/element-picker.ts` (new)
- `page/src/custom-elements.d.ts` (new)
- `page/src/ui/modes/edit/MolvisSketch.tsx`
- `page/src/ui/modes/edit/ToolsTab.tsx`
- `page/tsconfig.json`
- `page/tests/ui/modes/edit/MolvisSketch.test.tsx`
- `page/tests/ui/modes/edit/ToolsTab.test.tsx` (new)
- `regressions/shared-element-picker-03-page.test.ts` (new)

## Tasks

- [x] Write failing browser tests for both edit surfaces in `page/tests/ui/modes/edit/MolvisSketch.test.tsx` and `page/tests/ui/modes/edit/ToolsTab.test.tsx`
- [x] Add one explicit registration module in `page/src/ui/modes/edit/element-picker.ts`
- [x] Add typed JSX support in `page/src/custom-elements.d.ts`
- [x] Integrate the shared picker into `MolvisSketch.tsx` and remove `ELEMENTS`
- [x] Integrate the shared picker into `ToolsTab.tsx` and remove `COMMON_ELEMENTS`
- [x] Add regression example `regressions/shared-element-picker-03-page.test.ts` with hard-coded C-to-Fe consumer behavior
- [x] Run full check + test suite

## Testing strategy

- MolvisSketch 浏览器测试打开完整周期表、选择 Fe，并固定验证
  `SketchBoardState.element === "Fe"`；键盘选择 Cl 后触发器同步为 Cl。
- ToolsTab 使用最小 EditMode fake，选择 Fe 后固定验证 mode.element 与触发器值。
- 公共回归使用 core picker 的 input 协议分别驱动 SketchBoard 风格与 EditMode 风格
  consumer，固定期望 C → Fe。

## Out of scope

- React 版周期表、引擎 API 改名及页面之外的视觉主题重构。
