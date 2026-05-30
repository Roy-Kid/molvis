---
title: CombineSystemsModifier — overlay branches by atom-set extension
status: code-complete
created: 2026-05-30
---

# CombineSystemsModifier — overlay branches by atom-set extension

## Summary

新增一个用户可添加的 `CombineSystemsModifier`，把两个或更多被引用分支（branch）的输出帧通过**原子集扩展（atom-set extension）**拼接成一个更大的输出帧：所有分支的 `atoms` 行串接、`bonds` 索引按分支前缀原子数偏移、并写入一个每原子的 `source_id` 列以标记原子来自哪个分支。可选地，在拼接前用 spec-01 的 Kabsch 内核把每个非参考分支**成对**叠合到一个选定的参考分支上（默认关闭），从而实现“叠加多结构以比较差异”。该 modifier 改变原子数（拓扑变化），其重算必须走 `DrawFrameCommand` 全量重建路径，绝不走 `UpdateFrameCommand`。本子规格只实现 combine 节点本身，引用边/分支执行器（spec-02）与叠合内核（spec-01）由前置规格提供。

## Domain basis

- **拼接语义**：atom-set extension（原子集扩展），区别于 spec `docs/specs/multi-data-source-pipeline.md` 中的 augmentation（同一原子集上叠加 block/列）。该 prior-art 规格在 Non-goals 中**预留了 `CombineSystemsModifier` 名称**与“synthetic `source_id` block”作为 future work（见该文件第 60–67 行），本规格即落地该预留项。
- **叠合数学（由 spec-01 提供，此处仅引用）**：成对 Kabsch 叠合 `superpose(moving = branch_k, reference = ref_branch) → {R, t, rmsd}`，其中 `R` 为最小化 RMSD 的旋转矩阵、`t` 为平移；对 `branch_k` 的每个坐标施加 `pₖ ↦ R·pₖ + t` 后再拼接。v1 严格为**成对**（pairwise to one chosen reference），非广义 Procrustes。对应关系默认 = 同拓扑索引映射（identical-topology index map），可选 selection 子集；sequence/MCS 对应不在范围内。
- **参考文献**：Kabsch, W. (1976). *A solution for the best rotation to relate two sets of vectors.* Acta Cryst. A32, 922–923. DOI: 10.1107/S0567739476001873。RMSD 阈值/数值容差遵循 spec-01 内核约定，本规格测试沿用。

## Design

**实体与位置**：新增类 `CombineSystemsModifier`，文件 `core/src/modifiers/CombineSystemsModifier.ts`（沿用仓库既有约定——所有非 Draw 的用户 modifier 都放在 `core/src/modifiers/` 下，PascalCase 一类一文件，如 `DeleteSelectedModifier`、`SliceModifier`；`core/src/pipeline/` 仅放 `Draw*`）。继承 `BaseModifier`，capabilities = `{ TransformsData }`。

**分支引用（来自 spec-02）**：modifier 携带 `referencedIds: string[]`，按数组顺序即为分支序号 0..k-1。`apply()` 通过 `context.frameCache`（spec-02 提供的分支输出帧缓存）解析每个 `referencedIds[k]` 对应的**已计算输出帧**。本规格不实现 `referencedIds`/`frameCache` 机制，仅消费之；解析失败（缺帧/缺 `atoms`）由 `validate()` 与 `apply()` 防御。

**拼接（采用 `DeleteSelectedModifier` 的 frame-build 模式）**：`new Frame()` → 逐 block 串接列 → `insertBlock(...)`。
- `atoms` block：输出行数 = 各分支 `atoms.nrows()` 之和。逐列按 dtype 串接（`copyColF`/`copyColStr`/`viewColU32`/`viewColI32` 读，`setColF`/`setColU32`/`setColI32`/`setColStr` 写）。仅串接所有分支都存在的列；缺列分支的处理由 `validate()` 提前拦截（要求各分支列集合一致）。
- `bonds` block：分支 k 的 `atomi`/`atomj`（Uint32）写入前必须**加上前序分支累计原子数 `offsetₖ = Σ_{j<k} nₖ`**；`order`（Uint32，若存在）原样串接。
- **`source_id` 表示（确定决策）**：在输出 `atoms` block 内写入一个**每原子 `Int32` 列，列名 `source_id`，值 = 分支序号 0..k-1**。若某分支自身已带 `source_id` 列，则**以本 combine 节点的序号覆盖（last-writer = 本节点）**。该列供 spec-04 按来源着色/标注、并支持按来源选择。
- **simbox 策略**：取**参考分支的 simbox**；若叠合关闭（无参考分支选定），取**第一个被引用分支**的 simbox。确定且可复现；v1 **不做 box union**。

**可选叠合（在 `apply()` 内、拼接前执行，不拆成独立 AlignModifier）**：当 `alignment.enabled === true` 时，对每个非参考分支调用 spec-01 内核 `superpose(moving = branch_k, reference = ref_branch)` 得 `{R, t, rmsd}`，对该分支坐标施加 `R·p + t` 后再参与拼接。决策理由：叠合是“为比较而叠加”这一语义的内在组成，且需要与 combine 节点完全相同的已解析分支帧——拆成独立 modifier 会重复解析分支并把引用管线（referencedIds/frameCache）翻倍，故内联在 combine 节点。默认 `alignment.enabled = false`。开启时用户选定参考分支序号 + 对应关系（默认同拓扑索引映射；可选 selection 子集）。每分支的 `rmsd-to-reference` 暴露为 modifier 状态/元数据，供 spec-05 UI 展示。

**生命周期/重算路由（CLAUDE.md 不变量）**：该 modifier 改变原子数 → **拓扑变化**。其触发的重算必须走 `DrawFrameCommand`（全量重建），绝不走 `UpdateFrameCommand`。信号方式：combine 帧的输出经管线时 `PipelineContext.changeKind` 为 `"full"`（拓扑变化的既有语义，见 `types.ts` `FrameChangeKind`），从而下游 `ViewMode` 选择 `DrawFrameCommand`。combine modifier 自身不直接发命令；它仅产出新拓扑帧并依赖既有 changeKind="full" 路由。

**注册**：在 `registerDefaultModifiers`（`modifier_registry.ts`）注册，使其出现在“Add Modifier”选择器中（与 `DataSource` 子类不同——后者不注册；本类是用户主动添加的 modifier，故注册）。

**校验（`validate()`）**：
- `referencedIds.length < 2` → 失败，信息：`"Combine needs at least 2 referenced branches"`。
- 某 `referencedId` 在 `frameCache` 中无对应帧或缺 `atoms` block → 失败，指明缺失的分支。
- 各分支 `atoms` 列集合不一致（无法逐列串接）→ 失败。
- `alignment.enabled` 但参考分支与某移动分支原子数/顺序不匹配且未给 selection 子集 → 失败，信息明确（如 `"Alignment requested but branch N atom count differs from reference; provide a selection subset"`）。

## Files to create or modify

- `core/src/modifiers/CombineSystemsModifier.ts` (new) — the modifier class.
- `core/src/pipeline/modifier_registry.ts` — register `CombineSystemsModifier` in `registerDefaultModifiers`.
- `core/tests/modifiers/CombineSystemsModifier.test.ts` (new) — unit tests (rstest, mock SceneIndex).

## Tasks

- [x] Write failing tests for concat correctness in `core/tests/modifiers/CombineSystemsModifier.test.ts` (atom count = sum, bond offsets, source_id, simbox)
- [x] Implement `CombineSystemsModifier` class + capabilities `{TransformsData}` in `core/src/modifiers/CombineSystemsModifier.ts`
- [x] Implement branch resolution from `context.frameCache` via `referencedIds` and `validate()` rules in `core/src/modifiers/CombineSystemsModifier.ts`
- [x] Implement atoms/bonds concat with per-branch bond-index offset and `source_id` Int32 column (overwrite existing) in `core/src/modifiers/CombineSystemsModifier.ts`
- [x] Implement reference-branch simbox selection (no union) in `core/src/modifiers/CombineSystemsModifier.ts`
- [x] Write failing tests for optional pairwise alignment (off = unchanged; on = rotated branch restored within tol; mismatch errors)
- [x] Implement optional pairwise alignment via spec-01 `superpose` kernel before concat in `core/src/modifiers/CombineSystemsModifier.ts`
- [x] Register `CombineSystemsModifier` in `registerDefaultModifiers` (`core/src/pipeline/modifier_registry.ts`)
- [x] Add TSDoc per doc.style with units (Å) and `source_id` representation note
- [x] Run full check + test suite

## Testing strategy

映射到类型：concat/校验逻辑 → `code`；叠合数值正确性 → `scientific`；全量检查 → `runtime`。无 E2E/Playwright；modifier 逻辑完全可单元测试（mock `SceneIndex`，无 BabylonJS）。

- **Happy path（concat）**：两分支拼接，输出 `atoms.nrows()` = 两分支原子数之和。
- **Bond offset**：分支 1 的 `atomi`/`atomj` 在输出中按分支 0 原子数偏移；`order` 列原样串接。
- **source_id**：输出 `atoms` 含 `Int32` `source_id` 列，每原子序号正确（分支 0 全 0、分支 1 全 1）；分支已有 `source_id` 时被覆盖为本节点序号。
- **simbox**：输出 simbox = 参考分支（或叠合关闭时第一被引用分支）的 simbox。
- **Alignment OFF**：坐标与各分支输入逐元素一致。
- **Alignment ON（scientific）**：对一个已知刚体旋转的分支叠合回参考分支后，坐标在 spec-01 内核容差内与参考重合；验证调用的是 01 内核。
- **Edge：< 2 referenced branches** → `validate()` 失败并给出明确信息。
- **Edge：alignment 请求但原子数/顺序不匹配且无子集** → `validate()`/`apply()` 报错。
- **Topology-change signal**：拓扑变化经管线时 `changeKind` 为 `"full"`（走 `DrawFrameCommand` 路径），断言 combine 输出原子数 ≠ 输入即触发全量重建语义。
- **Full check + test suite**（runtime）：`npm run typecheck` + `npm run lint` + `npm test` 全绿。

## Out of scope

- spec-02 的通用引用边与分支执行器（`referencedIds`/`frameCache` 机制本体）。
- spec-01 的 Kabsch 内核内部实现。
- spec-04 的按来源着色 / `ColorBySource`。
- spec-05 的 page UI 面板（含 RMSD 展示组件）。
- 广义 Procrustes（>2 分支联合最优叠合）。
- sequence/MCS 对应关系。
- box union（多分支盒子合并）。
