---
status: code-complete
slug: shared-element-picker-02-sketch
created: 2026-07-30
grilled: true
---

# shared-element-picker-02-sketch

## Summary

让 standalone Sketch demo 直接消费 core 的 `<molvis-element-picker>`，删除本地
12 元素列表和按钮构建逻辑；picker 只把值交给既有 `SketchBoard.setElement()`。

## Domain basis

元素值仍由 `SketchBoard` 拥有，Web Component 只是共享输入控件。

## Design

- demo 显式调用 `defineMolvisElementPicker()`，Atom 工具激活时挂载 compact picker。
- picker 的 `value` 始终跟随 `SketchBoard.getElement()`；`input` 事件调用
  `setElement()` 与 `setTool("atom")`。
- 删除 `ELEMENTS`、`elementButtons` 与逐按钮同步，保留其它工具栏逻辑。

### Reuse decision

- generalize demo `ELEMENTS`：由 core picker 完整替代。
- reuse `SketchBoard.setElement`：不增加新的 Sketch 状态 API。

## Files to create or modify

- `sketch/examples/demo.ts`
- `sketch/tests/element_picker.test.ts` (new)
- `sketch/tsconfig.json`
- `sketch/tsconfig.build.json` (new)
- `sketch/rslib.config.ts`
- `regressions/shared-element-picker-02-sketch.test.ts` (new)

## Tasks

- [x] Write failing unit tests for core-picker-to-`SketchBoard` wiring in `sketch/tests/element_picker.test.ts`
- [x] Integrate `MolvisElementPickerElement` into `sketch/examples/demo.ts` and remove the local element list
- [x] Verify keyboard and programmatic element changes stay synchronized in `sketch/tests/element_picker.test.ts`
- [x] Add regression example `regressions/shared-element-picker-02-sketch.test.ts` with a hard-coded Fe selection
- [x] Run full check + test suite

## Testing strategy

- 浏览器单测创建 picker 与 `SketchBoard`，通过公共 input 协议选择 Fe，固定验证
  board 的 element 变为 `Fe` 且 tool 为 `atom`。
- 回归示例只使用 core picker 和公开 SketchBoard API，不读取 demo 私有状态。

## Out of scope

- 改变 SketchBoard 元素状态模型或键盘快捷键。
- 在 sketch 中复制 Shadow DOM、周期表数据或 picker 样式。
