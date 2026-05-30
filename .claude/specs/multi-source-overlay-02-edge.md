---
title: Pipeline reference-edge + branch-aware executor
status: approved
created: 2026-05-30
---

# Pipeline reference-edge + branch-aware executor

## Summary
为修饰器流水线引入一种新的依赖边：**引用边（reference edge）**，使某个修饰器能够在 `apply()` 阶段读取**其它修饰器的输出帧**，而不仅仅是读取上游传递下来的单一帧或选择掩码。本子规格只交付通用机制——在 `Modifier` 上新增 `referencedIds: string[]` 字段、在 `PipelineContext` 上新增 `frameCache: Map<modifierId, Frame>`、在 Phase B 执行器中按拓扑顺序缓存每个修饰器的输出帧并向引用方暴露被引分支的输出，以及完整性/环检测校验与最小 RPC 接口。本子规格**不**包含 `CombineSystemsModifier`、concat 拼接逻辑、Kabsch 对齐、`source_id`、着色或 UI（分别属于链中 01/03/04/05）。交付物附带一个仅用于测试的 double 修饰器以驱动并验证整条引用通路。

## Domain basis
本子规格是引擎机制，无物理方程。唯一相关的领域约束来自 molrs WASM 帧句柄的所有权模型（项目不变量）：`frameCache` 持有的是流水线在 Phase B 中拥有的**工作帧**句柄；`getBlock`/`simbox` 返回的共享句柄不得被 `free`，仅 `WasmArray` 结果与流水线自身拥有的 `Frame` 可被释放。引用方在读取被引分支输出时只做只读访问（如 `getBlock`/`blockNames`/`nrows`），不得 `free` 任何被引帧或其块句柄——拼接/拷贝语义留给 03。

## Design
**边的种类（决策 1）**：在 `Modifier` 接口与 `BaseModifier` 上新增 `referencedIds: string[]`（默认 `[]`），与既有 `parentId` 并列且语义正交：
- `parentId` 承载**选择掩码**（`selectionCache`），且按 `pipeline.ts:199` 被 `isTopologyChanging` 修饰器禁止持有。
- `referencedIds` 承载**帧数据**（`frameCache`），其消费方正是一个拓扑改变型 concat 节点（03）。因此 `:199` 的禁令**只作用于 selection-parent 边**，对 reference 边不适用——`setReferences` 不调用 `isTopologyChanging` 门禁。本规格在 `setReferences` 的 JSDoc 中显式声明这一点。

**执行与缓存机制（决策 2）**：在 `PipelineContext` 新增 `frameCache: Map<string, Frame>`，与 `selectionCache`（types.ts:197）类比。Phase B 中每个非 DS 修饰器 `apply()` 返回后，将其输出帧以其 `id` 为键写入 `frameCache`（类比 selectionCache 在 pipeline.ts:379 的写入）。引用方在其 `apply()` 内通过 `context.frameCache.get(refId)` 解析 `referencedIds`。

**顺序保证（决策 2）**：采用「被引修饰器必须在数组顺序中先于消费者」+ 执行前校验的方案（不引入隐式拓扑重排，保持线性数组的可预测性）。在 Phase B 开始前做一次轻量前置校验：对每个 `enabled` 修饰器，若其任一 `enabled` 引用目标在数组中位于其**之后**，记 `logger.warn` 并将该引用视为缺失（消费者在 `frameCache` 中查不到 → 当作 absent，见决策 3）。`setReferences` / `addModifier` 时也做静态环检测，从源头杜绝不可线性化的图。

**完整性与降级规则（决策 3）**：
- 自引用：`setReferences` 拒绝（id ∈ referencedIds → 返回 false）。
- 环：`setReferences` 在合并 reference 边后做 DFS 环检测，发现环则拒绝。
- 悬空引用（目标 id 不在流水线中）：`setReferences` 拒绝写入；`removeModifier` 移除某修饰器时，**自动从所有引用方的 `referencedIds` 中剔除指向它的项**（auto-drop）并 emit `MODIFIER_REFERENCES_CHANGED`，**不**级联删除消费者。
- 被引分支 `enabled === false`：执行器把它当作 absent（`frameCache` 无此键），`compute` 前置校验 `logger.warn` 一条提示；消费者照常运行，自行决定缺分支时的行为。

**RPC（决策 4，最小面）**：新增 `pipeline.set_references` 处理器，payload `{ id, referenced_ids: string[] }`（空数组即清空）。调用 `pipeline.setReferences`，失败抛 `invalidParams`，成功后 `applyPipeline({ fullRebuild: true })`。UI 留给 05。

**changeKind 备注**：reference 喂给的拓扑改变（concat，03）需走 `DrawFrameCommand` 全量重建——本规格不实现 concat，但执行器不得阻塞拓扑改变型消费者；现有 `changeKind` 路由不变。

## Files to create or modify
- `core/src/pipeline/modifier.ts` — 在 `Modifier` 接口与 `BaseModifier` 新增 `referencedIds: string[]`（默认 `[]`）。
- `core/src/pipeline/types.ts` — 在 `PipelineContext` 新增 `frameCache: Map<string, Frame>`；在 `createDefaultContext` 初始化为空 `Map`。
- `core/src/pipeline/pipeline.ts` — 新增 `setReferences(id, ids)`（自引用/环/悬空校验 + 事件）；`removeModifier` 中 auto-drop 悬空引用；`compute` Phase B 前置顺序校验 + 每个修饰器 apply 后写 `frameCache`；新增 `MODIFIER_REFERENCES_CHANGED` 事件键。
- `core/src/transport/rpc/router.ts` — 注册并实现 `pipeline.set_references` 处理器。
- `core/tests/reference_edge.test.ts` (new) — 引用边机制的全部单元/运行测试与测试 double 修饰器。

## Tasks
- [ ] Write failing tests for reference-edge resolution and integrity in `core/tests/reference_edge.test.ts` (a–h cases below)
- [ ] Add `referencedIds: string[]` to `Modifier` interface and `BaseModifier` default `[]` in `core/src/pipeline/modifier.ts`
- [ ] Add `frameCache: Map<string, Frame>` to `PipelineContext` and init in `createDefaultContext` in `core/src/pipeline/types.ts`
- [ ] Implement `setReferences(id, ids)` with self/cycle/dangling validation + `MODIFIER_REFERENCES_CHANGED` event in `core/src/pipeline/pipeline.ts`
- [ ] Implement auto-drop of dangling references in `removeModifier` (no cascade-delete of consumer) in `core/src/pipeline/pipeline.ts`
- [ ] Implement Phase B `frameCache` write-after-apply + pre-pass ordering validation (warn + treat-as-absent for forward/disabled refs) in `core/src/pipeline/pipeline.ts`
- [ ] Implement `pipeline.set_references` RPC handler in `core/src/transport/rpc/router.ts`
- [ ] Add docstring per TSDoc with handle-ownership note (no freeing shared block/simbox handles) on `setReferences` and `frameCache`
- [ ] Run full check + test suite

## Testing strategy
框架 rstest，mock `SceneIndex`，无 BabylonJS（沿用 `dag_pipeline.test.ts` 的 `makeFrame` / `mockApp` 与一个新的 `ReferenceConsumerSpy`/`BranchTagModifier` 测试 double：分支修饰器在帧上写一个可辨识块/列，消费者从 `context.frameCache` 读取被引分支输出并记录）：
- happy path (a): 消费者从 `frameCache` 读到正确的被引分支输出。
- isolation (b): 引用某个**不在** `referencedIds` 中的分支 → 对消费者不可见。
- self-reference (c): `setReferences(x, [x])` 返回 false，`referencedIds` 不变。
- cycle (d): `x→y` 已存在时 `setReferences(y, [x])` 返回 false。
- dangling (e): `setReferences(x, ["unknown"])` 返回 false（拒绝写入）。
- disabled branch (f): 被引分支 `enabled=false` → 消费者视为 absent，`compute` 产生一条 warn，且不抛错。
- removal auto-drop (g): `removeModifier(branch)` 后消费者仍存在且其 `referencedIds` 不再含被删 id。
- ordering (h): 被引分支在数组顺序中先于消费者时，分支输出在消费者 apply 前已入 `frameCache`；反序时触发 warn 且视为 absent。
领域校验：不适用（引擎机制，无物理目标）。

## Out of scope
- `CombineSystemsModifier` 及其 concat / 拓扑拼接逻辑（spec 03）。
- Kabsch 对齐（spec 01）。
- `source_id` 列与多源标识（spec 03）。
- 着色 / `ColorBySource`（spec 04）。
- page 端 UI 面板与引用边的可视化编辑（spec 05）。
- 泛化的 >2 路 Procrustes / 多分支合并语义。
- `frameCache` 的跨 `compute` 持久化或缓存复用（每次 compute 重建，本规格不做缓存优化）。
