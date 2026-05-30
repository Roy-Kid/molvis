---
title: Kabsch structural-superposition kernel
status: code-complete
created: 2026-05-30
---

# Kabsch structural-superposition kernel

## Summary

为多结构叠合比较功能（multi-source-overlay 链的第 1 步）提供一个纯函数式的刚体叠合内核。给定一个移动点集 P 与一个参考点集 Q（1:1 对应），内核计算把 P 最优叠合到 Q 上的刚体变换（旋转矩阵 R 与平移向量 t）并返回 RMSD。内核只操作扁平的 `Float64Array` 点集，不依赖 BabylonJS，也不在边界上依赖 WASM `Frame`，因此可以在 rstest 中独立做已知答案单元测试，无需 mock 场景。后续 spec（02 边界、03 combine、04 着色、05 UI）会把 Frame block 适配成 `Float64Array` 后调用本内核。

## Domain basis

约定：P = 移动点集（被旋转 + 平移），Q = 参考点集（固定）；二者都是配对好的点，按列排成 3×n。目标是在真旋转（det = +1）加平移下最小化 Σₖ‖R pₖ + t − qₖ‖²；结果把 P 叠合到 Q 上。**方向约定必须显式声明**：H 取参考在行、移动在列（H = Q̃ P̃ᵀ），R = U·diag(1,1,d)·Vᵀ。写错 H 与 Hᵀ、或写成 V Uᵀ 而非 U Vᵀ，都会悄悄把 R 转置（得到逆变换），所以下文与代码必须一字不差地遵守此约定，并在单元测试中以已知答案钉死方向。

KABSCH 步骤：
1. t = q̄ − R p̄；旋转在中心化坐标上解耦：p̃ₖ = pₖ − p̄，q̃ₖ = qₖ − q̄。
2. 最大化 tr(R H)。
3. H = Σₖ q̃ₖ p̃ₖᵀ = Q̃ P̃ᵀ（3×3，行 = 参考，列 = 移动）。
4. 对 H 做 SVD：H = U Σ Vᵀ，Σ = diag(σ₁ ≥ σ₂ ≥ σ₃ ≥ 0)。
5. d = sign(det(U Vᵀ))（= sign(det H)，因 det Σ ≥ 0），R = U·diag(1,1,d)·Vᵀ —— d 项强制真旋转（SO(3)）。没有 d，可能得到非真旋转（镜像，翻转手性）；翻转作用在最小奇异方向上。对手性分子即使 det H ≈ 0 也**始终**强制真旋转，且 d 必须从 SVD 因子 sign(det(U Vᵀ)) 计算，不要用阈值化的 det H。
6. 用修正后的 R 计算 t = q̄ − R p̄；最后施加 pₖ ↦ R pₖ + t。

RMSD（单位 Å）：
- 不加权（默认）：sqrt((1/N) Σₖ‖R pₖ + t − qₖ‖²)。
- 质量加权（可选）：sqrt(Σ wₖ‖…‖² / Σ wₖ)，wₖ = mₖ；做法是用 √wₖ 预乘中心化坐标，并用加权质心。

对应关系：相同拓扑的恒等索引映射（k ↦ k）为 v1 的可辩护默认；选区限定子集叠合可接受；序列/残基比对与图/MCS 匹配均不在范围内。

数值稳定性：det H ≈ 0 时强制真旋转，d 取 sign(det(U Vᵀ))；det H = 0 不意味着平面/镜像。σ₂ ≈ σ₃ 近简并时旋转不唯一但 RMSD 良定义（不要对外暴露原始轴/角）。共线/共面秩亏时应给出告警而非伪精度。N = 1 时 R = I、t = q₁ − p₁、RMSD = 0。N = 2 时绕键轴的旋转未定，采用确定性约定（恒等扭转）并记录。使用稳健 SVD，**不要**对 HᵀH 做特征分解。

引用：
- Kabsch W. 1976. *Acta Cryst.* A32:922–923.
- Kabsch W. 1978. *Acta Cryst.* A34:827–828.
- Coutsias EA, Seok C, Dill KA. 2004. *J Comput Chem* 25(15):1849–1857. DOI 10.1002/jcc.20110.
- Lawrence J, Bernal J, Witzgall C. 2019. *J Res NIST* 124:124028. DOI 10.6028/jres.124.028.

## Design

**模块边界**：内核生活在 `core/src/system/` 这一层（与 `topology.ts`、`frame_diff.ts` 同级；`core/src/math/` 不存在，不新建该目录）。所有点集以扁平、列主无关的 `Float64Array` 表示，长度 3N（点 k 的坐标在偏移 `3k, 3k+1, 3k+2`）。内核是纯函数 —— 绝不修改输入数组，结果以新对象返回。

**核心数据类型**（在 `superposition.ts` 中定义并导出）：
- `Vec3`（length-3 `Float64Array`）、`Mat3`（length-9 `Float64Array`，行主，`m[3*r+c]`）的内部别名。
- `SuperpositionResult`：`{ R: Float64Array /*9, 行主*/, t: Float64Array /*3*/, rmsd: number }`。

**核心 API**（精确签名）：
- `superpose(moving: Float64Array, reference: Float64Array, options?: SuperposeOptions): SuperpositionResult`
  —— 计算把 `moving`（P）叠合到 `reference`（Q）的最优刚体变换。两数组必须等长且为 3 的倍数；否则抛出带清晰信息的错误。
- `SuperposeOptions = { weights?: Float64Array; indices?: Uint32Array }`
  —— `weights`（长度 N，质量）启用质量加权 RMSD 与加权质心；缺省即不加权。`indices` 限定参与叠合拟合的点子集（长度 ≤ N，值为点索引）；缺省即全体 1:1。
- `rmsd(moving: Float64Array, reference: Float64Array, options?: { weights?: Float64Array }): number`
  —— 在**不**做叠合的前提下计算当前坐标的 RMSD（供 03 在施加变换后核验，以及测试用）。
- `applyTransform(points: Float64Array, R: Float64Array, t: Float64Array): Float64Array`
  —— 返回新数组 pₖ ↦ R pₖ + t（纯函数）。

**对应关系辅助**（在 `superposition.ts`）：
- `identityCorrespondence(countMoving: number, countReference: number): Uint32Array`
  —— 等数量时返回 `[0,1,…,N-1]`；数量不等时抛出清晰错误，绝不静默 zip 错配原子。
- 选区受限子集通过 `SuperposeOptions.indices` 表达（无独立函数）。

**SVD 设计决策（最大实现风险，显式标注）**：TypeScript 没有内建 SVD。我们在 `core/src/system/svd3.ts`（new）实现一个自包含、无依赖的 3×3 SVD：`svd3(H: Float64Array): { U: Float64Array; S: Float64Array; V: Float64Array }`（均行主 length-9 / length-3）。采用基于单边 Jacobi 的 3×3 SVD（对 H 的列做 Jacobi 旋转，等价于对 HᵀH 隐式对角化但**不显式构造 HᵀH**，从而保留小奇异值的精度），保证 σ₁ ≥ σ₂ ≥ σ₃ ≥ 0 且 U、V 为正交阵。理由：避免引入新依赖、保持内核可在 rstest 纯环境下运行、3×3 规模下 Jacobi 数值稳健且实现量小。**绝不**对 HᵀH 做显式特征分解（会平方化条件数、丢失小奇异方向精度——正是 d 翻转所作用的方向）。

**所有权 / 生命周期**：内核不持有 WASM 句柄，不分配需手动 `free()` 的对象；所有返回值是普通 JS `Float64Array`，由调用者（03 modifier）管理。

## Files to create or modify

- `core/src/system/svd3.ts` (new) — 自包含 3×3 Jacobi SVD：`svd3(H)`。
- `core/src/system/superposition.ts` (new) — Kabsch 内核：`superpose`、`rmsd`、`applyTransform`、`identityCorrespondence`、类型 `SuperpositionResult` / `SuperposeOptions`。
- `core/src/system/index.ts` — 从 barrel 导出 `superpose`、`rmsd`、`applyTransform`、`identityCorrespondence` 及类型。
- `core/tests/svd3.test.ts` (new) — 3×3 SVD 重构与正交性已知答案测试。
- `core/tests/superposition.test.ts` (new) — Kabsch 内核已知答案 + 误差路径测试。

## Tasks

- [x] Write failing tests for svd3 (core/tests/svd3.test.ts)
- [x] Implement svd3 (Jacobi 3x3 SVD) in core/src/system/svd3.ts
- [x] Write failing tests for superpose/rmsd/applyTransform/identityCorrespondence (core/tests/superposition.test.ts)
- [x] Implement applyTransform and identityCorrespondence in core/src/system/superposition.ts
- [x] Implement superpose (Kabsch with proper-rotation d-term) and rmsd in core/src/system/superposition.ts
- [x] Add TSDoc per doc.style to all public symbols with units (Å) and P/Q + H direction convention
- [x] Export superpose, rmsd, applyTransform, identityCorrespondence and types from core/src/system/index.ts
- [x] Verify against known-answer cases (identity, translation, rotation recovery, reflection/det-sign, N=1, N=2, collinear, mass-weighted, hand-computed RMSD)
- [x] Run full check + test suite

## Testing strategy

纯 rstest，无 BabylonJS、无 WASM Frame。

happy path：
- 恒等：P == Q ⇒ R = I（≈ 单位阵）、t ≈ 0、rmsd ≈ 0。
- 纯平移：Q = P + c ⇒ R ≈ I、t ≈ c、rmsd ≈ 0。
- 精确旋转恢复：对 P 施加已知 90° 旋转与一个任意旋转得到 Q，叠合后恢复该旋转、rmsd ≈ 0。

edge cases：
- 反射 / det 符号情形：构造使无 d 项会得到镜像的数据，断言选出真旋转（det(R) = +1），无手性翻转。
- N = 1：R = I、t = q₁ − p₁、rmsd = 0。
- N = 2：绕键轴扭转未定，断言确定性约定（恒等扭转）下结果可复现。
- 共线 / 共面（秩亏）：得到有限的真旋转结果，rmsd 良定义；不产生 NaN。
- 对应关系误差路径：moving/reference 原子数不等且未给 `indices` ⇒ 抛出清晰信息的错误，绝不静默 zip。
- `indices` 子集：仅在子集上拟合，结果与对该子集单独叠合一致。

domain validation（scientific）：
- 质量加权 vs 不加权：在不均质量分布下二者 RMSD 数值不同且各自匹配手算参考。
- RMSD 数值核验：对一个小手算参考构型，断言返回 RMSD 与手算值在容差内一致。
- svd3：随机及构造的 3×3 矩阵满足 U Σ Vᵀ ≈ H、U/V 正交、σ₁ ≥ σ₂ ≥ σ₃ ≥ 0。

## Out of scope

- pipeline 集成、`CombineSystemsModifier`（spec 03）。
- `source_id` 概念、着色（spec 04）、任何 UI（spec 05）。
- 多结构（>2）广义 Procrustes 叠合。
- 序列 / 残基比对、图 / MCS 对应关系发现（对应关系在本 spec 仅限恒等索引映射与显式子集）。
- 暴露旋转的轴/角表示（近简并时不唯一）。
