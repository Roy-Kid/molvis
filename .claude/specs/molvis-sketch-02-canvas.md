---
title: "molvis-sketch-02-canvas: Canvas 2D + pointer tools"
status: approved
created: 2026-07-29
grilled: true
---

# molvis-sketch-02-canvas: Canvas 2D + pointer tools

## Summary

在已落地的 `@molcrafts/molvis-sketch` 模型层之上，提供仅依赖原生 Canvas 2D 的 `SketchBoard`：挂载 `HTMLCanvasElement`、管理工具状态机（atom / bond / select / erase）、完成屏幕↔文档坐标与命中测试，并按脏标记调度重绘。调用方可用指针绘制原子与键、选择与删除、撤销重做，并经 `getMoleculeData` / `toFrame` 取出与 01 模型一致的数据，全程不依赖 React、page 或 core。**禁止引入任何第三方 2D 绘图库**（Konva / Pixi / Fabric / Two.js 等）。

## Domain basis

No physics; interactive geometry only. 文档坐标类 Å；屏幕坐标为 CSS 像素。

## Design

### 前驱

`molvis-sketch-01-model`：`MoleculeGraph`、`SketchHistory`、`MoleculeData`、`toFrame`/`fromFrame`、Add/Remove atom/bond 命令。

### 实体

| 符号 | 职责 |
|------|------|
| `SketchBoard` | 公共入口：挂载、工具、指针/键盘、历史、脏重绘、数据读写 |
| `ViewportCoords` | 屏幕 ↔ 文档；dpr 感知 `resize` |
| `HitTester` | 原子圆 / 键段命中 |
| `SketchRenderer` | 原子圆+标签、1/2/3 键、选中高亮 |
| `SKETCH_ELEMENT_COLORS` | 包内最小色表（H/C/N/O/F/P/S/Cl/Br/I + 默认灰） |

### 公共 API

```ts
type SketchTool = "atom" | "bond" | "select" | "erase";

class SketchBoard {
  constructor(options?: { atomRadiusDoc?: number; omitCarbonLabel?: boolean });
  // default omitCarbonLabel = true

  mount(canvas: HTMLCanvasElement): void;
  unmount(): void;
  resize(cssWidth: number, cssHeight: number): void;

  setTool(tool: SketchTool): void;
  setElement(symbol: string): void;
  setBondOrder(order: 1 | 2 | 3): void;

  clear(): void;
  undo(): void;
  redo(): void;

  getMoleculeData(): MoleculeData;
  loadMoleculeData(data: MoleculeData): void;
  toFrame(): Frame; // 委托 MoleculeGraph.toFrame
}
```

- `mount` 绑定 pointer/key，`canvas.tabIndex = 0`；重复 mount = 先 unmount 再挂。
- 重绘：`markDirty` → 至多一帧 rAF；空闲不常转。
- 色表硬编码（对齐 core CPK 字面量副本，**不** import core）：H `#FFFFFF`, C `#C8CDD6`, N `#3050F8`, O `#FF0D0D`, F `#90E050`, P `#FF8000`, S `#FFFF30`, Cl `#1FF01F`, Br `#A62929`, I `#940094`；未知 `#808080`。

### 指针策略

| 工具 | 行为 |
|------|------|
| atom | click 空白 → 放当前元素；click 已有原子 → 忽略（不重复放） |
| bond | down 在原子 A；up 在 B → 加键（当前 order）；up 空白 → **碳链**（见下）；up 在 A → 取消 |
| select | click 切换选中；click 空白清空 |
| erase | click 原子 → 删原子+关联键；click 键 → 删键 |

**碳链**（bond 落空）：沿 A→P 按文档步长 `1.2` 放中间碳（含终点碳），当前 order 连成链；**一次 undo** 恢复拖前（复合命令或 history 批量）。

**键盘**：聚焦时 Delete/Backspace 删选中；无选中 no-op。

### 命中

- 原子：距离 ≤ `atomRadiusDoc`（默认 `0.35` 文档单位，JSDoc 写死）
- 键：点到线段距离 ≤ 半宽；重叠优先原子

### Reuse decision

- **reuse** `MoleculeGraph.toFrame` / `getMoleculeData` / `loadMoleculeData` — board 委托
- **reuse** `SketchHistory` — 编辑经 history
- **new** `SKETCH_ELEMENT_COLORS` — 禁止 core 依赖
- **new** page / generate3D / place_molecule — out of scope

## Files to create or modify

- `sketch/src/style/element_colors.ts` (new)
- `sketch/src/board/coords.ts` (new)
- `sketch/src/board/hit_test.ts` (new)
- `sketch/src/board/sketch_renderer.ts` (new)
- `sketch/src/board/sketch_board.ts` (new)
- `sketch/src/index.ts` — 导出 `SketchBoard`、`SketchTool`、`SKETCH_ELEMENT_COLORS`
- `sketch/tests/style/element_colors.test.ts` (new)
- `sketch/tests/board/coords.test.ts` (new)
- `sketch/tests/board/hit_test.test.ts` (new)
- `sketch/tests/board/sketch_renderer.test.ts` (new)
- `sketch/tests/board/sketch_board.test.ts` (new)
- `regressions/molvis-sketch-02-canvas.test.ts` (new)

## Tasks

- [ ] Write failing unit tests for `SKETCH_ELEMENT_COLORS`, `ViewportCoords`, and `HitTester` (`sketch/tests/style/element_colors.test.ts`, `sketch/tests/board/coords.test.ts`, `sketch/tests/board/hit_test.test.ts`)
- [ ] Implement `SKETCH_ELEMENT_COLORS`, `ViewportCoords`, and `HitTester` in `sketch/src/style/element_colors.ts`, `sketch/src/board/coords.ts`, `sketch/src/board/hit_test.ts`
- [ ] Write failing unit tests for `SketchRenderer` (`sketch/tests/board/sketch_renderer.test.ts`)
- [ ] Implement `SketchRenderer` in `sketch/src/board/sketch_renderer.ts` (native Canvas 2D only)
- [ ] Write failing unit tests for `SketchBoard` tools, lifecycle, Delete key, dirty/rAF, data delegates (`sketch/tests/board/sketch_board.test.ts`)
- [ ] Implement `SketchBoard` in `sketch/src/board/sketch_board.ts`; re-export from `sketch/src/index.ts`; add jsdoc-tiered docs
- [ ] Add regression example `regressions/molvis-sketch-02-canvas.test.ts` (public API; hard-coded water + chain goldens)
- [ ] Run full check + test suite

## Testing strategy

- **ElementColors**：H–I 硬编码 hex；未知灰
- **ViewportCoords**：dpr=2、200×100 → 400×200；往返 ≤1e-6
- **HitTester**：原子优先；空图 miss
- **SketchRenderer**：mock ctx；C 省略字母；order 2/3 多 stroke
- **SketchBoard**：四工具 + 碳链一次 undo + Delete + 单 rAF
- **Regression**：水型 3 原子 2 键；碳链步长金标；`toFrame` 拓扑

## Out of scope

- ChemDraw 高级：环模板、立体楔形 UI、框选拖移、电荷（→ 03）
- React / page / shadcn
- core / generate3D
- 第三方绘图库
- pan/zoom 手势 UI（Viewport 可预留 identity；手势在 03）
