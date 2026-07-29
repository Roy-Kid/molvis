---
title: "molvis-sketch-04-page: replace Kekule with molvis-sketch"
status: approved
created: 2026-07-29
grilled: true
---

# molvis-sketch-04-page: replace Kekule with molvis-sketch

## Summary

在 page 的 Edit → Builder「2D Sketch」路径中，彻底移除 Kekule，改用 workspace 包 `@molcrafts/molvis-sketch` 的 `SketchBoard`，并由新的 React 宿主 `MolvisSketch` 提供 shadcn 工具栏、主题色绑定、resize 与命令式导出。用户仍可按既有产品路径完成「绘制 → Generate 3D → 放置」；SMILES 与 Download 路径不变。page 优先调用 `toFrame()`，不再手拼 atoms/bonds 列。

## Domain basis

No physics; UI integration only.

## Design

### 前驱

01–03 已交付 `@molcrafts/molvis-sketch`（ChemDraw 级 `SketchBoard`、`getMoleculeData`/`toFrame`）。

### `MolvisSketch`（new）

路径：`page/src/ui/modes/edit/MolvisSketch.tsx`

- mount/dispose `SketchBoard`；**不**在 page 重实现引擎
- `ResizeObserver` → board.resize
- 主题：molvis CSS 变量 → board（**禁止** GIF invert / `filter: invert`）
- shadcn / viewer 控件：元素、键级、工具（atom/bond/select/erase/ring/chain/charge/stereo 以 board 暴露为准）、undo/redo/clear
- ref：`getMoleculeData()` + **`toFrame()`**
- a11y：`ViewerOperationState` 加载/错误；canvas `aria-label="2D molecule sketch"`
- 容器 class：`molvis-sketch-container`（替换 `.kekule-container`）

### `BuilderTab`

- 删除 `KekuleComposer`；`sketchRef` → `toFrame()` → **reuse** `generateAndPlace`
- SMILES / Download / `useViewerOperation` 不变
- **禁止**在 sketch 包内调 `generate3D`

### Kekule 清退（零残留）

- 移除 `page/package.json` 的 `kekule`
- 删除：`KekuleComposer.tsx`、`kekule-overrides.css`、`kekule-loader.ts`、`kekule-types.d.ts`
- 删除 tailwind `--molvis-kekule-*`
- `StructureInspector`：`.molvis-sketch-container`
- rsbuild：移除仅服务 kekule 的 mock/ignoreWarnings

### 依赖

- `page/package.json`：`"@molcrafts/molvis-sketch": "*"`（workspace）
- 如需：page tsconfig/rsbuild alias 镜像 `@molvis/core` 写法
- **不**改 `core/`

### Reuse decision

- **reuse** `generateAndPlace` / `placeFrame`
- **reuse** shadcn / ViewerAction / ViewerOperationState
- **reuse** sketch board API（generalize 已在 01–03 完成）
- **remove** 全部 Kekule 表面

## Files to create or modify

- `page/package.json`
- `package.json` — 仅当 workspace 缺 sketch 时补全
- `page/tsconfig.json` — 如需 alias
- `page/rsbuild.config.ts` — 去 kekule mocks；如需 sketch alias
- `page/src/ui/modes/edit/MolvisSketch.tsx` (new)
- `page/src/ui/modes/edit/BuilderTab.tsx`
- `page/src/components/viewer/StructureInspector.tsx`
- `page/src/styles/tailwind.css`
- `page/src/ui/modes/edit/KekuleComposer.tsx` — delete
- `page/src/ui/modes/edit/kekule-overrides.css` — delete
- `page/src/lib/kekule-loader.ts` — delete
- `page/src/lib/kekule-types.d.ts` — delete
- `page/tests/ui/modes/edit/MolvisSketch.test.tsx` (new)
- `regressions/molvis-sketch-04-page.test.ts` (new)
- `package-lock.json` — install 后更新

## Tasks

- [ ] Write failing unit tests for MolvisSketch host export contract (`page/tests/ui/modes/edit/MolvisSketch.test.tsx`; mock SketchBoard)
- [ ] Add page workspace dependency on `@molcrafts/molvis-sketch` (page/package.json; alias only if missing)
- [ ] Implement MolvisSketch (mount, ResizeObserver, CSS-token theme, shadcn toolbar, ViewerOperationState, aria-label, ref getMoleculeData/toFrame)
- [ ] Wire BuilderTab to MolvisSketch with toFrame → generateAndPlace; keep SMILES and Download paths
- [ ] Remove Kekule completely from page (files, dep, tokens, StructureInspector, rsbuild mocks)
- [ ] Add JSDoc (jsdoc-tiered) on MolvisSketch public ref/props
- [ ] Add regression example `regressions/molvis-sketch-04-page.test.ts` (hard-coded: no kekule dep/imports; BuilderTab uses MolvisSketch)
- [ ] Run full check + test suite

## Testing strategy

- **Unit** `TestMolvisSketch`：mock board；toFrame/getMoleculeData 委托；工具栏调用；null 空分子；dispose；class + aria-label
- **Regression**：package.json 有 sketch 无 kekule；`page/src` 零 `kekule`/`Kekule`/`.kekule-container`/`--molvis-kekule-`；BuilderTab 含 MolvisSketch + toFrame
- 不写真实绘制 e2e / generate3D 于 unit

## Out of scope

- page 内重写引擎
- sketch 包内 generate3D
- core 改动
- SMILES/Download/Edit 放置语义重设计
- VSCode/Python 专属 UI
- 发布 sketch 到 npm registry（workspace 即可）
