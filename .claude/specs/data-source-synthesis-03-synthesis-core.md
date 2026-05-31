---
title: Scene synthesis core — compose multiple source trajectories into one merged frame
status: code-complete
created: 2026-05-31
---

# Scene synthesis core — compose multiple source trajectories into one merged frame

## Summary

新增纯函数模块 `core/src/system/scene_synthesis.ts`，把多条来源轨迹（每条一个 `Trajectory`）在给定时间轴索引处合成为一个 `Frame`。支持两种模式：`extend`（原子集拼接 / concat）与 `augment`（同原子集列并集，冲突列后者覆盖）。可选在拼接前对每个非参考来源做 Kabsch 刚体叠合到参考来源，并暴露每来源 RMSD。本模块不依赖 BabylonJS、不做管线接线、不做拓扑变化检测——它只产出 `Frame`，可用 mock 数据单元测试。拓扑变化（原子数变化）的探测与路由由调用方（04 的 frame_diff / pipeline）负责。

## Domain basis

可选的拼接前结构叠合复用上游链 spec-01 的 Kabsch 内核 `core/src/system/superposition.ts`（`superpose` / `applyTransform`，本规格 **不修改** 该文件）。约定：`P = moving` 经 `pₖ ↦ R·pₖ + t` 旋转平移到 `Q = reference`；以适当旋转修正强制 `det(R) = +1`，避免镜像解。坐标与 RMSD 单位为 Å。

参考文献（数学源自上游链 spec-01，此处仅引用、不重证）：
- Kabsch, W. (1976). *Acta Cryst.* A32, 922–923.
- Kabsch, W. (1978). *Acta Cryst.* A34, 827–828.
- Coutsias, E. A., Seok, C., & Dill, K. A. (2004). *J. Comput. Chem.* 25, 1849–1857. DOI: 10.1002/jcc.20110

质量加权（`massWeight`）通过 `superpose` 的 `weights` 选项传入 `mass` 列；对应子集（`subset`）通过 `indices` 选项传入。两者直接转交内核，本模块不重新实现加权或子集逻辑。

## Design

**入口函数**

```
synthesize(sources: SynthesisSource[], frameIndex: number, config: SceneSynthesisConfig): Frame
```

**类型（可序列化）**

- `SynthesisSource = { id: string; trajectory: Trajectory }` — `Trajectory` 来自 `core/src/system/trajectory.ts`。
- `SceneSynthesisConfig = { mode: "extend" | "augment"; referenceId: string | null; alignment: SynthesisAlignment | null }`。
- `SynthesisAlignment = { enabled: boolean; massWeight: boolean; subset: Uint32Array | null }`。`subset` 为相对每个来源原子的索引子集（与 `superpose` 的 `indices` 同义）。

**每来源帧计数协调**（在 `frameIndex` 处，针对每个 enabled 来源）：
- `trajectory.length === 1`（单帧）→ **广播**：每个索引都取 `frame(0)`。
- `length === maxLength`（与时间轴最大长度相等）→ 取 `frame(frameIndex)`。
- `length > 1` 且 `!== maxLength` → 抛出明确错误，指名来源 id、其长度与期望长度。

> 时间轴长度（`maxLength`）取所有来源 `trajectory.length` 的最大值；参考来源若存在则以其长度作为期望基准。

**`extend` 模式**（原子集扩展 / 迁移自 `CombineSystemsModifier`）：
- 拼接所有来源的 `atoms` 块列，按来源序拼接（来源 0 在前）。
- 列按 dtype 分别拼接：String / F64 / U32 / I32（迁移 `CombineSystemsModifier.ts:244-289` 的 `concatColumn`）。缺列时抛出指名来源序号与列名的错误。
- `bonds` 的 `atomi`/`atomj` 按前序来源累计原子数偏移；缺 `order` 默认 1（迁移 `concatBonds`，第 302-340 行）。
- 写入 per-atom Int32 `source_id` 列 = 来源序号 `0..k-1`，覆盖任何输入中已有的 `source_id`。
- `simbox` = 参考来源（若 alignment.enabled）或来源 0 的 box，绝不取并集。

**`augment` 模式**（同原子集列并集，旧 Phase A 语义）：
- 各来源块按块名并集；块名冲突时后者覆盖（last-wins）。不偏移、不注入 `source_id`。

**可选拼接前叠合（仅 `extend`）**：当 `alignment.enabled` 时，每个非参考来源用 `packCoords` 取 x/y/z 拼成 `3N`，调 `superpose(moving, refCoords, { indices?, weights? })`，再用 `applyTransform` 把 `R,t` 作用到该来源坐标后再拼接；返回的 `Frame` 上同时暴露每来源 RMSD（参考来源自身省略）。对应关系：默认同拓扑恒等索引映射；提供 `subset` 时用之。无 `subset` 且原子数不一致 → 抛出指名来源 id、两侧原子数的清晰错误。

**单来源直通**：恰好 1 个 enabled 来源时，直接返回其 `frame(frameIndex)` 原样（零配置、无合成开销、**不注入 `source_id`**）。

**纯度与拓扑信号**：`synthesize` 为纯函数，不修改入参 `Frame`/`Trajectory`，不调 BabylonJS、不做拓扑探测。`extend` 改变原子数这一事实由调用方（04）据此路由 `changeKind="full"` / `DrawFrameCommand`；本模块仅产出 `Frame`。

**RMSD 输出形状**：`synthesize` 直接返回 `Frame`；每来源 RMSD 通过返回 frame 的 meta（`frame.setMeta("synthesis_rmsd", JSON.stringify(rmsdById))`）暴露，避免改动签名引入额外返回类型。alignment 关闭或直通时不写该 meta。

## Files to create or modify

- `core/src/system/scene_synthesis.ts` (new) — 模块本体：`synthesize` + 类型 `SynthesisSource` / `SceneSynthesisConfig` / `SynthesisAlignment`，以及私有 `packCoords` / `unpackCoords` / `concatColumn` / `concatBonds` / 帧计数协调辅助函数（迁移自 `CombineSystemsModifier`）。
- `core/tests/scene_synthesis.test.ts` (new) — rstest 单元测试，覆盖 extend / augment / broadcast / equal-length zip / unequal>1 error / single-source passthrough / alignment ON / alignment mismatch error。

## Tasks

- [x] Write failing tests for synthesize extend/augment/broadcast/passthrough (core/tests/scene_synthesis.test.ts)
- [x] Write failing tests for synthesize alignment + error paths (core/tests/scene_synthesis.test.ts)
- [x] Define SynthesisSource / SceneSynthesisConfig / SynthesisAlignment types in core/src/system/scene_synthesis.ts
- [x] Implement frame-count reconciliation (broadcast / zip / unequal>1 throw) in core/src/system/scene_synthesis.ts
- [x] Implement extend mode column+bond concat with source_id (migrate CombineSystemsModifier concat) in core/src/system/scene_synthesis.ts
- [x] Implement augment mode block union (last-wins) in core/src/system/scene_synthesis.ts
- [x] Implement single-source passthrough and synthesize dispatch in core/src/system/scene_synthesis.ts
- [x] Implement optional pre-concat Kabsch alignment via superpose/applyTransform with per-source rmsd in core/src/system/scene_synthesis.ts
- [x] Add TSDoc per doc.style with units (Å) and Kabsch refs on synthesize and exported types
- [x] Run full check + test suite

## Testing strategy

Happy path:
- **extend**：两个来源（3 + 2 原子），合成 frame 原子数 = 5；`source_id` = `[0,0,0,1,1]`；来源 1 的 bond `(0,1)` 偏移为 `(3,4)`；列拼接顺序与来源序一致。
- **augment**：同原子集来源 A、B，B 携带与 A 同名块时 B 覆盖 A（last-wins）；不注入 `source_id`、不偏移。
- **broadcast**：一个 length-1 来源 + 一个 length-3 来源，在 `frameIndex` 0/1/2 合成时单帧来源每次都贡献其 `frame(0)`。
- **equal-length zip**：两个 length-3 来源，`frameIndex=k` 时各取 `frame(k)`。
- **single-source passthrough**：1 个 enabled 来源，返回的 frame 与 `frame(frameIndex)` 内容一致且 **无** `source_id` 列。

Edge cases:
- **unequal>1 error**：length-2 与 length-3 来源（均 >1 且不等）→ 抛错且消息含两个长度。
- **alignment mismatch error**：alignment.enabled、无 subset、两来源原子数不同 → 抛错且消息指名两侧原子数。

Domain validation (`$META.science.required`):
- **alignment ON**：把参考来源坐标用已知旋转生成第二个来源，alignment 开启后合成；该来源经叠合后坐标在 spec-01 容差内还原到参考，meta 中其 RMSD ≈ 0（验证 `superpose`→`applyTransform` 路径接通）。
- **mass-weighted alignment**：带 `mass` 列时 `massWeight` 传入 `superpose` 的 `weights`，RMSD 仍 ≈ 0（确认加权选项转交正确）。

## Out of scope

- 管线接线、Phase A 移除、spec-02 移除（属 04）。
- `DataSource` 子类型（属 02）。
- RPC（属 05）、UI（属 06）。
- 广义 >2 来源的 Procrustes（generalized superposition）。
- 序列 / MCS 对应关系——本模块只支持恒等索引映射或显式 `subset`。
- 拓扑变化探测 / `changeKind` 路由——调用方（frame_diff / pipeline）职责。
