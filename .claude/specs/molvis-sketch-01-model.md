---
title: "molvis-sketch-01-model: graph, history, Frame IO"
status: done
created: 2026-07-29
grilled: true
---

# molvis-sketch-01-model: graph, history, Frame IO

## Summary

在 monorepo 中新增独立 npm workspace 包 `@molcrafts/molvis-sketch`，与 `@molcrafts/molvis-core` 并列。本阶段只交付 2D 分子图数据模型、可逆命令栈，以及与 BuilderTab 列布局一致的 Frame 导入/导出；不引入画布、ChemDraw 操作或 page 集成。包仅依赖 `@molcrafts/molrs`（Frame/Block），禁止依赖 `@molcrafts/molvis-core`、Babylon 或 React。对外稳定契约为 `MoleculeData` / `Atom2D` / `Bond2D`，由 `MoleculeGraph` 持有并提供 `loadMoleculeData` / `getMoleculeData` / `toFrame` / `fromFrame`；编辑通过 `SketchCommand` 的 `do()`/`undo()` 与 `SketchHistory` 完成，导出数据为深拷贝以免被调用方静默污染。

## Domain basis

No physics; graph topology only. 坐标为文档单位下的抽象 2D 空间（类 Å 量级，非像素）；本阶段不做 3D 构象、力场或化学价态校验。

## Design

### 包边界与依赖

- 新建 workspace 包 `sketch/`，包名 `@molcrafts/molvis-sketch`。
- `dependencies` 仅 `@molcrafts/molrs`（解析与 monorepo 中 core 一致）。
- `package.json` **不得** 声明 `@molcrafts/molvis-core`、`@babylonjs/*`、`react`、`react-dom`。
- 构建形态对齐 core 库包子集：rslib ESM、`exports["."]`、`typecheck`、`rstest`、`tests/setup_wasm.ts` 预加载 molrs WASM（bundler target）。
- 根 `package.json`：`workspaces` 加入 `"sketch"`；增加 `typecheck:sketch` / `test:sketch`，并串入根 `typecheck` / `test`。

### 公共数据契约（稳定 API）

将 page 侧 `KekuleComposer.getMoleculeData` 的临时形状提升为 sketch 引擎上的稳定类型：

```ts
interface Atom2D {
  element: string;
  x: number;
  y: number;
  charge?: number;
}

interface Bond2D {
  i: number;
  j: number;
  order: number;
  stereo?: "none" | "up" | "down";
}

interface MoleculeData {
  atoms: Atom2D[];
  bonds: Bond2D[];
}
```

- `x`/`y`：文档单位 2D 坐标（类 Å），**不是**屏幕像素。
- `getMoleculeData()` 返回**深拷贝**；`loadMoleculeData(data)` 以输入的深拷贝替换图内容。

### `MoleculeGraph`

- 公开原语：`loadMoleculeData` / `getMoleculeData` / `toFrame` / `fromFrame`。
- `toFrame()` 列布局对齐 `page/src/ui/modes/edit/BuilderTab.tsx`：
  - atoms block：`element`（`setColStr`）
  - bonds block（有键时）：`atomi` / `atomj` / `order`（`setColU32`）
  - 本阶段 `toFrame` **不要求**写出 `x`/`y`（与 BuilderTab 一致，供后续 `generate3D`）
- `fromFrame`：读 `element` + `atomi|atomj|order`；无 2D 坐标列时赋**确定**的合成坐标（固定规则，单测锁定，例如线性排布）。
- `charge` / `stereo` 可在图模型内保留；本阶段**不**经 Frame 往返。
- 构造：`new MoleculeGraph()`；无 `make_*` / `create_*` 工厂。

### 命令与历史

- `SketchCommand`：`do()` / `undo()`（同步；无 `MolvisApp`）。
- `SketchHistory`：独立实现 `execute` / `undo` / `redo` / `canUndo` / `canRedo` / `clearHistory`（**pattern** core CommandManager，**禁止** import core）。
- 最小可逆命令：`AddAtomCommand` / `RemoveAtomCommand` / `AddBondCommand` / `RemoveBondCommand`。
- 删除原子策略（固定并写 JSDoc）：删除原子时同步删除关联键，并重映射存活键端点索引。

### 源码布局

```
sketch/src/
  index.ts
  types.ts
  molecule_graph.ts
  sketch_command.ts
  sketch_history.ts
  commands/edit_commands.ts
```

### Reuse decision

- **reuse** BuilderTab Frame column layout — `toFrame` 必须使用 `atoms.element` + `bonds.atomi`/`atomj`/`order`。
- **generalize** `KekuleComposer.getMoleculeData` → 稳定 `MoleculeData` API（本阶段只在 sketch 落地；page 接线在 04）。
- **reuse** molrs `Frame`/`Block` — 仅编解码；本阶段不调用 `generate3D`/`parseSMILES`。
- **pattern** core Command do/undo — 独立 `SketchCommand` + `SketchHistory`。
- **new** CPK palette — 本阶段无渲染。
- **new** place_molecule / pendingMolecule — 属 core/page。
- **new** page shadcn — 本阶段无 UI。

## Files to create or modify

- `package.json` — workspaces + `typecheck:sketch` / `test:sketch` 串入根脚本
- `sketch/package.json` (new)
- `sketch/rslib.config.ts` (new)
- `sketch/tsconfig.json` (new)
- `sketch/rstest.config.ts` (new)
- `sketch/src/index.ts` (new)
- `sketch/src/types.ts` (new)
- `sketch/src/molecule_graph.ts` (new)
- `sketch/src/sketch_command.ts` (new)
- `sketch/src/sketch_history.ts` (new)
- `sketch/src/commands/edit_commands.ts` (new)
- `sketch/tests/setup_wasm.ts` (new)
- `sketch/tests/molecule_graph.test.ts` (new)
- `sketch/tests/sketch_history.test.ts` (new)
- `sketch/tests/commands/edit_commands.test.ts` (new)
- `regressions/molvis-sketch-01-model.test.ts` (new)

## Tasks

- [x] Scaffold `@molcrafts/molvis-sketch` package + root workspace wiring (`sketch/package.json`, `sketch/rslib.config.ts`, `sketch/tsconfig.json`, `sketch/rstest.config.ts`, `sketch/tests/setup_wasm.ts`, root `package.json`)
- [x] Write failing unit tests for MoleculeGraph (`sketch/tests/molecule_graph.test.ts` → MoleculeGraph: load/get deep-copy, toFrame columns, fromFrame round-trip)
- [x] Implement Atom2D/Bond2D/MoleculeData + MoleculeGraph in `sketch/src/types.ts` + `sketch/src/molecule_graph.ts` and export from `sketch/src/index.ts`
- [x] Write failing unit tests for SketchHistory + edit commands (`sketch/tests/sketch_history.test.ts`, `sketch/tests/commands/edit_commands.test.ts`)
- [x] Implement SketchCommand, SketchHistory, and Add/Remove Atom/Bond commands in `sketch/src/sketch_command.ts`, `sketch/src/sketch_history.ts`, `sketch/src/commands/edit_commands.ts` (export from index)
- [x] Add JSDoc per jsdoc-tiered (units for x/y document-Å; Frame column contract; delete-atom index policy)
- [x] Add regression example `regressions/molvis-sketch-01-model.test.ts` (public API only; hard-coded goldens, no third-party runtime)
- [x] Run full check + test suite

## Testing strategy

- **Unit**（`sketch/tests/`，镜像 src，单行为，无 e2e）：
  - `molecule_graph.test.ts`：深拷贝隔离；`toFrame` 列；`toFrame`→`fromFrame` 拓扑；空分子 / 单原子 / 非法键索引错误策略（选定后硬编码）
  - `sketch_history.test.ts`：execute/undo/redo；空栈 false；新 execute 清 redo
  - `commands/edit_commands.test.ts`：各命令 do/undo 对称；删原子后键/索引策略
- **Hard-coded**：H₂O 拓扑字面量等
- **Regression** `regressions/molvis-sketch-01-model.test.ts`：公共 API；H₂O `load`→`toFrame` 列→`fromFrame`→拓扑；`AddAtom`+`undo`；注释 provenance 2026-07-29
- **Runner**：`npm run typecheck -w sketch`、`npm run test -w sketch`；根 typecheck/test 含 sketch；regressions 经 `npm run test:regressions`（01 脚手架须保证根 `regressions/molvis-sketch-*.test.ts` 被拾取——可扩展 core regressions config 或 sketch 专用 runner，实现时二选一并写进 package scripts）

## Out of scope

- 画布 / 指针 / ChemDraw 手势
- page 替换 Kekule
- 依赖 core / Babylon / React
- `generate3D` / `parseSMILES` / 3D 放置
- CPK 渲染、选择高亮
- Frame 完整往返 charge/stereo
- npm 正式发布流程
