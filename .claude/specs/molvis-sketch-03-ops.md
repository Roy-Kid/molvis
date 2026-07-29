---
title: "molvis-sketch-03-ops: ChemDraw-level operations"
status: approved
created: 2026-07-29
grilled: true
---

# molvis-sketch-03-ops: ChemDraw-level operations

## Summary

在 01 模型 + 02 画布之上，补齐有机小分子手绘所需的 **ChemDraw 级操作**，使 sketch 包能力足以替代 Kekule Composer：环模板（3–8 元脂环 + 苯环中心圆显示）、连续碳链工具、键级循环、楔形/虚线立体键、形式电荷、框选/多选与拖移、键盘快捷键、平移与光标锚定缩放、清空与 fit-to-view。芳环圆为 **cosmetic**（非 Hückel/芳香性感知）。全部结构变更经 `SketchCommand` 进 undo/redo；`MoleculeData` 携带 `charge`/`stereo`。

## Domain basis

几何构造 only。苯环显示策略固定为环心圆；不做芳香性算法、力场或 SMILES layout（layout → molrs 后续）。

## Design

### 前驱路径约定

沿用 01–02 已落路径（勿另起平行目录树除非必要）：

- `sketch/src/types.ts`、`molecule_graph.ts`、`sketch_command.ts`、`sketch_history.ts`、`commands/edit_commands.ts`
- `sketch/src/board/sketch_board.ts`、`coords.ts`、`hit_test.ts`、`sketch_renderer.ts`
- 本阶段新增：`geometry/`、`board/viewport.ts`、`board/keymap.ts`、新 commands/tools

### 模型扩展

- `Atom2D.charge: number`（默认 0；渲染上标；与 01 可选 `charge` 字段统一为 required default 0）
- `Bond2D.stereo: "none" | "up" | "down"`（仅 order===1；升 2/3 时强制 none）
- 多选：`SketchBoard` 持有选中 atom 索引集合；键删除/移动随端点

### 几何常量

| 常量 | 值 | 含义 |
|------|-----|------|
| `DEFAULT_BOND_LENGTH` | `1.0` 文档单位 | 链/环默认边长 |
| `SNAP_RADIUS` | `0.35 × DEFAULT_BOND_LENGTH` | 端点吸附 |
| 环 | `3…8` + `benzene` | 脂环全单键；苯 6 元 + 中心圆 |

### 新命令（do/undo）

`PlaceRingCommand`、`PlaceChainCommand`、`CycleBondOrderCommand`、`SetBondStereoCommand`、`AdjustAtomChargeCommand`、`MoveSelectionCommand`、`ClearDocumentCommand`（+ 复用 01–02 增删）

### 交互

- **RingTool**：click 默认尺寸；drag 定半径；顶点 SNAP 合并
- **ChainTool**：固定键长折线碳；过短不建
- **Bond 扩展**：点击已有键 cycle 1→2→3→1；wedge/hash 子模式
- **Select 扩展**：marquee；shift-click；拖选区 = 一次 `MoveSelectionCommand`
- **Charge**：±1 对 hover/选中原子
- **Viewport**：中键或 Space+拖 pan；滚轮光标锚定 zoom；`fitToView()`
- **Keymap**：`1/2/3`；`C N O H P S F` + `Cl`/`Br`/`I`；Cmd/Ctrl+Z / Shift+Z / Y；Delete；Esc；Space pan

### 渲染扩展

楔形 up / 散列 down；电荷上标；benzene 中心圆；marquee 橡胶筋；多选高亮。纯 Canvas 2D。

### Reuse decision

- **reuse** `SketchCommand` / `SketchHistory` / `MoleculeGraph` / `SketchBoard` — 扩展，不平行第二套引擎
- **new** molrs layout — out of scope
- **new** page / Kekule — out of scope（04）

## Files to create or modify

- `sketch/src/types.ts` — charge/stereo 字段定稿
- `sketch/src/molecule_graph.ts` — 批量环/链合并、近邻、平移
- `sketch/src/geometry/ring_template.ts` (new)
- `sketch/src/geometry/chain_builder.ts` (new)
- `sketch/src/geometry/snap.ts` (new)
- `sketch/src/commands/place_ring_command.ts` (new)
- `sketch/src/commands/place_chain_command.ts` (new)
- `sketch/src/commands/cycle_bond_order_command.ts` (new)
- `sketch/src/commands/set_bond_stereo_command.ts` (new)
- `sketch/src/commands/adjust_atom_charge_command.ts` (new)
- `sketch/src/commands/move_selection_command.ts` (new)
- `sketch/src/commands/clear_document_command.ts` (new)
- `sketch/src/board/viewport.ts` (new)
- `sketch/src/board/keymap.ts` (new)
- `sketch/src/board/sketch_board.ts` — 注册工具/快捷键/clear/fit
- `sketch/src/board/sketch_renderer.ts` — stereo/charge/aromatic circle/marquee
- `sketch/src/index.ts` — 导出公共符号
- `sketch/tests/geometry/ring_template.test.ts` (new)
- `sketch/tests/geometry/chain_builder.test.ts` (new)
- `sketch/tests/geometry/snap.test.ts` (new)
- `sketch/tests/commands/ops_commands.test.ts` (new)
- `sketch/tests/board/keymap.test.ts` (new)
- `sketch/tests/board/viewport.test.ts` (new)
- `sketch/tests/board/select_ops.test.ts` (new)
- `regressions/molvis-sketch-03-ops.test.ts` (new)

## Tasks

- [ ] Write failing unit tests for RingTemplate, ChainBuilder, Snap, ops commands, Keymap, Viewport, multi-select move (`sketch/tests/geometry/*`, `sketch/tests/commands/ops_commands.test.ts`, `sketch/tests/board/{keymap,viewport,select_ops}.test.ts`)
- [ ] Extend Atom2D/Bond2D/MoleculeGraph for charge, stereo, neighbor query, batch ring/chain merge, atom translate (`sketch/src/types.ts`, `sketch/src/molecule_graph.ts`)
- [ ] Implement RingTemplate + Snap + PlaceRingCommand + ring tool wiring (`sketch/src/geometry/{ring_template,snap}.ts`, `sketch/src/commands/place_ring_command.ts`, `sketch/src/board/sketch_board.ts`)
- [ ] Implement ChainBuilder + PlaceChainCommand + chain tool wiring (`sketch/src/geometry/chain_builder.ts`, `sketch/src/commands/place_chain_command.ts`, board)
- [ ] Implement CycleBondOrder, SetBondStereo, AdjustAtomCharge commands and bond-tool click/stereo modes
- [ ] Implement marquee/shift multi-select + MoveSelectionCommand + drag selection
- [ ] Implement Viewport pan/zoom, Keymap, ClearDocumentCommand, fitToView, renderer stereo/charge/benzene circle/marquee; jsdoc-tiered units; export from index
- [ ] Add regression example `regressions/molvis-sketch-03-ops.test.ts` (public API; hard-coded goldens)
- [ ] Run full check + test suite

## Testing strategy

- Ring：size 3–8 顶点；benzene 同拓扑 + kind；merge 减原子数
- Chain：水平 3.0 → 3 段；过短 0 键；起点吸附
- Snap：半径内外
- Commands：键级循环清 stereo；charge 0→+1→+2→+1；clear undo；move undo
- Keymap / Viewport：快捷键表；光标锚定缩放
- Select：marquee size=2；shift toggle；一次 move command
- **Regression**：程序化 benzene → chain → cycle bond → stereo up → charge +1 → 断言字面量计数 + undo charge；无 Kekule/molrs 子进程

## Out of scope

- 反应箭头、自由文本、query atom、聚合物括号
- 完整周期表对话框
- SMILES clean / molrs layout
- page 接线 / Kekule 删除（04）
- 芳香性感知 / 交替双键
- Frame 列写 stereo/charge（MoleculeData 必须带；Frame 可选）
- core / page / vsc-ext / python 改动
