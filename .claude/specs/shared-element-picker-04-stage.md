---
status: code-complete
slug: shared-element-picker-04-stage
created: 2026-07-30
grilled: true
---

# shared-element-picker-04-stage

## Summary

让 Stage 自带的 Edit context menu 也直接渲染 core
`<molvis-element-picker>`，删除其最后一份 C/N/O/H 选项表。

## Design

- 扩展既有 binding view，增加 `element-picker` 类型；通用菜单控制只负责把
  core picker 的 `input` 转成原有 `BindingEvent`。
- `EditMode` 继续拥有 `element` 状态，只把 Element binding 从 list 改为
  `element-picker`。
- Stage 显式注册 core 组件，不复制周期表数据、Shadow DOM 或组件样式。

## Files to create or modify

- `stage/src/mode/types.ts`
- `stage/src/mode/edit.ts`
- `stage/src/ui/components/slider.ts`
- `stage/tsconfig.json`
- `stage/tsconfig.build.json` (new)
- `stage/rslib.config.ts`
- `stage/tests/ui/components/element_picker.test.ts` (new)

## Tasks

- [x] Write a failing Stage binding test
- [x] Add the reusable `element-picker` binding view
- [x] Replace EditMode's local C/N/O/H list
- [x] Run Stage typecheck and targeted browser tests

## Out of scope

- Replacing other list, checkbox, or range bindings.
- A second Stage-specific periodic-table renderer.
