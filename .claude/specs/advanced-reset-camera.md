---
title: Advanced reset camera (radius-aware, per-axis, OBB, PBC, auto-view)
status: approved
created: 2026-06-12
---

# Advanced reset camera (radius-aware, per-axis, OBB, PBC, auto-view)

## Summary

升级 molvis-core 的复位/取景相机算法,一次性修掉当前五处缺陷,让 `resetCamera()` 后的取景对细长、斜放、含 PBC 盒、宽屏/竖屏等各种结构都紧凑且不裁切。取景将感知每原子 vdW 半径(不再切边缘球)、按视口宽高比逐轴拟合(宽屏也收紧而非只补偿竖屏)、对斜放/细长结构改用基于半径加权 PCA 的定向包围盒(OBB)以消除 AABB 的过度留白、在存在模拟盒时可框住整盒、并支持"自动挑选展示最多结构的视角"(opt-in)。所有几何均为纯函数、可在 NullEngine 下确定性单测;turntable 因共享 `fitBoundsToView` 而同步受益,且其现有签名与默认语义保持向后兼容。

## Why

现状取景对细长/斜放结构过度留白、边缘大半径球被裁、宽屏视口浪费可视面积;最讽刺的是每原子半径 `r` 已经在内存里(`scene_index.ts:942` 的 stride=4 `[x,y,z,r]`),却在 `getBounds()` 中被丢弃 —— 修复成本极低却直接消除"半个 vdW 球被裁"。OBB / 逐轴 fit / PBC 框盒 / 自动视角逐一对应五处缺陷。由于 `fitBoundsToView` 同时被 `World.resetCamera`(`world.ts:174`)与 turntable 的 `CameraAnimator.buildTurntable`(`camera/animator.ts:186`)共用,改进取景同时惠及视频导出。几何 PCA 选在 TS 内做 3×3 对称特征分解而非绕 molrs `WasmPca2`:N×3 坐标协方差体量极小,纯 TS 无 WASM handle 生命周期负担、且能在 NullEngine 下确定性单测;`WasmPca2` 服务的是 `analysis/exploration.ts` 的 N×D 描述符 PCA,语义与本 spec 不同,不复用。

## Domain basis

非物理方程,几何/线性代数,无需 scientist;此处给出取景所依赖的闭式公式与退化处理约定。

- 半径感知 AABB:对每原子中心 `c_i` 与半径 `r_i`,包围盒 `min = min_i(c_i − r_i)`、`max = max_i(c_i + r_i)`,使每个 vdW 球整体落入盒内。
- 协方差与主轴(OBB):以半径加权质心 `μ = Σ w_i c_i / Σ w_i`(`w_i` 取 `r_i` 或 1,见 Design)为中心,构造对称 3×3 协方差 `C = Σ w_i (c_i−μ)(c_i−μ)ᵀ / Σ w_i`;对 `C` 做对称特征分解得到正交主轴 `e_1,e_2,e_3`(特征值 `λ_1≥λ_2≥λ_3`)。OBB 范围 = 把 `c_i±r_i` 投影到各主轴取 min/max。3×3 对称矩阵用闭式或 Jacobi 旋转分解(数值稳健、可单测)。
- 逐轴取景距离:对水平半张角 `θ_h`(由竖直 `fov` 与 `aspect` 推得:`tan θ_h = aspect·tan(fov/2)`)与竖直半张角 `θ_v = fov/2`,分别要求 `dist ≥ halfWidth / tan θ_h`、`dist ≥ halfHeight / tan θ_v`,取 `dist = max(两者)`,再 ×`FIT_PADDING`、clamp 到 `FIT_MIN_DISTANCE`。此式在宽屏(aspect>1)下也会收紧,且在 aspect<1 时退化为旧的"竖屏加宽"行为(向后兼容)。
- 退化处理(必须显式):当 `λ_1≈λ_2`(各向同性云,如球)或 `λ_2≈λ_3`(共面)或 `λ_1≈λ_2≈λ_3`(共线/单原子)时,特征向量方向 FP 脆弱 —— 此时回退到确定性方向(AABB 轴 / 固定 iso 角),绝不产生 NaN、不抛异常。相对阈值判定特征值近重(如 `λ_k − λ_{k+1} < ε·λ_1`)。
- 单位:所有长度 Å,角度 radians,坐标 Z-up(相机为 `ArcRotateCamera`,Z-up)。

## Design

实体与符号:

- `camera/fit.ts`(扩展,纯函数)—— 保留现有 `fitBoundsToView(bounds, fov, aspectRatio)` 签名与默认语义不变(以满足既有 `camera-trajectory-turntable` 的 ac-005 characterization 锁),仅在其内部把"仅竖屏补偿"升级为"逐轴 fit"的**等价超集**:aspect<1 时数值结果与旧式一致,aspect≥1 时收紧。新增 `ViewFitOptions`(可选)与新函数 `fitBoxToView(obb | bounds, fov, aspectRatio, options?)`,承载 OBB 取景 / 自动视角方向计算,返回扩展的 `ViewFit`(新增可选 `direction?: {alpha, beta}`)。既有调用方零改动即可继续工作;需要新能力的调用方显式传 OBB/options。
- `camera/obb.ts`(new,纯函数)—— `computeObb(points: Float64Array, radii: Float64Array | null): Obb`,内部含 `covariance3x3`、`symEig3x3`(对称 3×3 特征分解,闭式/Jacobi)、半径加权质心、向各主轴投影取 extent。导出 `Obb` 接口(`center: Vec3`、`axes: [Vec3,Vec3,Vec3]`、`halfExtents: Vec3`、`degenerate: boolean`)。退化(近重特征值/共线/单原子)时置 `degenerate=true` 并把 `axes` 设为世界轴,供上层回退。
- `camera/auto_view.ts`(new,纯函数)—— `pickViewDirection(obb): {alpha, beta}`,沿最小主轴(`λ_3` 方向)看以最大化投影轮廓面积;`obb.degenerate` 时回退固定 iso 角 `α=π/4, β=π/3`。
- `scene_index.ts` 的 `getBounds()` —— 不改其返回类型(`{min,max}|null`),避免影响所有现有消费者;新增半径感知:既有调用读到的盒按每原子 `r`(`data[idx+3]`)扩张(`min-=r, max+=r`)。同时新增一个**点+半径取数**入口 `getBoundsData(): {points: Float64Array, radii: Float64Array} | null`(零拷贝读 `instanceData`,stride=4),供 OBB/PCA 使用,而不让 OBB 逻辑侵入 SceneIndex。
- `world.ts` 的 `resetCamera(options?)` —— 编排层:取半径感知 bounds + 可选 `getBoundsData()`;按 `options.viewDirection`(`"iso" | "auto"`,默认 `"iso"`)与 `options.frameBox`(默认沿用当前行为)决定调用 `fitBoundsToView`(默认/AABB)或 `fitBoxToView`(OBB/自动视角);存在 `frame.simbox` 且 `frameBox` 开启时,把盒 8 角(`box.hMatrix()` 列向量 + `box.origin()`,`.toCopy()` 后 free handle)纳入取景点集,确保整盒可见;clip-plane 撑大逻辑保留。所有数学下沉到 `camera/*`,`world.ts` 只做编排与相机写入,不塞几何。

生命周期/所有权:`camera/*` 全为无状态纯函数;`box.hMatrix()/origin()/lengths()` 的 `WasmArray` 在 `world.ts` 内 `.toCopy()` 后立即 free,不跨函数边界传 handle。

取舍记录(应同时写入 `.claude/notes/core-arch.md` 的取景小节):几何 PCA 用 TS 内 3×3 对称特征分解,不复用 molrs `WasmPca2`(后者是 N×D 描述符 PCA),理由见 Why。

向后兼容与共享面声明:`fitBoundsToView(bounds, fov, aspectRatio)` 是 `World.resetCamera`(`world.ts:174`)与 `CameraAnimator.buildTurntable`(`camera/animator.ts:186`)的共享面,并被 `index.ts:105` 公开导出、被既有 `camera-trajectory-turntable.acceptance.md` 的 ac-005 锁定。本 spec **不改其签名、不改其默认数值语义**(aspect<1 路径逐位等价);新增能力一律走可选参数 / 新函数 `fitBoxToView`。`getBounds()` 返回类型不变,仅内部扩张半径,因此其三个消费者(`world.ts:144` 注入 animator 的闭包、`world.ts:171`、`animator.ts:184`)无需改动即享半径感知。turntable 可选地接入 OBB(通过 `buildTurntable` 内改调 `fitBoxToView`),作为同惠增益。

## Files to create or modify

- `core/src/camera/obb.ts` (new) —— `computeObb`、`covariance3x3`、`symEig3x3`、`Obb` 接口。
- `core/src/camera/auto_view.ts` (new) —— `pickViewDirection`。
- `core/src/camera/fit.ts` —— 升级为逐轴 fit(aspect<1 等价旧式);新增 `ViewFitOptions`、`fitBoxToView`、`ViewFit.direction?`。
- `core/src/scene_index.ts` —— `getBounds()` 半径感知扩张;新增 `getBoundsData()`。
- `core/src/world.ts` —— `resetCamera(options?)` 编排:radius-aware bounds、OBB/auto-view 分派、PBC 框盒、保留 clip-plane 逻辑。
- `core/src/camera/animator.ts` —— `buildTurntable` 可选接入 OBB(`fitBoxToView`),共享面回归保障。
- `core/src/index.ts` —— 导出新公开符号 `fitBoxToView`、类型 `Obb`、`ViewFitOptions`。
- `core/tests/camera_obb.test.ts` (new) —— OBB/PCA/退化数学单测(NullEngine 无关,纯函数)。
- `core/tests/camera_fit.test.ts` —— 追加逐轴 fit / `fitBoxToView` / 半径感知几何断言;保留既有 characterization 断言绿。
- `core/tests/camera_auto_view.test.ts` (new) —— 自动视角方向单测。
- `core/tests/world_reset_camera.test.ts` (new) —— `resetCamera(options?)` 编排:radius-aware、PBC 框盒、`"iso"` 默认角向后兼容、turntable 共享面回归(NullEngine)。

## Tasks

- [ ] Write failing tests for OBB/PCA math (core/tests/camera_obb.test.ts) — 轴对齐盒、对角细棒(1,1,1)、各向同性球、共线/单原子退化
- [ ] Implement computeObb + covariance3x3 + symEig3x3 + Obb in core/src/camera/obb.ts
- [ ] Write failing tests for per-axis fit and fitBoxToView (core/tests/camera_fit.test.ts) — 含宽屏收紧、竖屏等价、半径感知几何、OBB-vs-AABB distance、保留 ac-005 characterization
- [ ] Implement per-axis fit upgrade + ViewFitOptions + fitBoxToView in core/src/camera/fit.ts
- [ ] Write failing tests for auto view direction (core/tests/camera_auto_view.test.ts) — 细长结构沿最小主轴、退化回退 iso
- [ ] Implement pickViewDirection in core/src/camera/auto_view.ts
- [ ] Implement radius-aware getBounds + getBoundsData in core/src/scene_index.ts
- [ ] Audit getBounds callers (world.ts:144, world.ts:171, animator.ts:184) for radius-expansion regressions
- [ ] Write failing tests for resetCamera orchestration (core/tests/world_reset_camera.test.ts) — radius-aware、PBC 框盒 8 角可见、默认 iso 角、turntable buildTurntable 共享面回归
- [ ] Implement resetCamera(options?) orchestration + PBC box framing + auto-view dispatch in core/src/world.ts
- [ ] Wire optional OBB into buildTurntable (core/src/camera/animator.ts) and export fitBoxToView/Obb/ViewFitOptions in core/src/index.ts
- [ ] Add TSDoc per project style with units (Å, radians) to new symbols, then run full check + test suite

## Testing strategy

Happy path:
- 半径感知:含一个大半径边缘原子的场景,reset 后该原子整球落在视锥内 —— 断言半径感知 `getBounds` 已把该原子的 `r` 计入(`min ≤ c−r`、`max ≥ c+r`),或经 `fitBoundsToView` 的 center/radius 几何断言整球在锥内。
- 逐轴 fit:宽屏(aspect>1)、横向很宽的盒,新算法 distance ≤ 旧算法(恰好让宽度铺满,而非按竖直 FOV 浪费);竖屏(aspect<1)结果与旧式逐位一致。
- OBB:对角细棒(沿 (1,1,1))的 OBB 取景 distance 明显小于 AABB 取景 distance(给数值断言,如 OBB distance ≤ 0.7×AABB distance),过度留白被消除。
- PBC:`frame.simbox` 存在且 `frameBox` 开启时,盒 8 角全部落在视锥内(对 `hMatrix` 列向量 + origin 构造 8 角,几何断言)。
- 自动视角:细长结构 `viewDirection="auto"` 时相机方向 ≈ 沿最小主轴(投影轮廓最大);`"iso"`(默认)时角仍是 `α=π/4, β=π/3`。

Edge cases:
- 退化:单原子 / 共线点 / 各向同性球,不抛、不产 NaN,`computeObb.degenerate=true` 并回退确定性方向(AABB / 固定 iso);近重特征值用相对阈值判定。
- 无数据:`getBounds()` 返回 null 时 `resetCamera` 走 fallback(target=原点, radius=10, iso 角),与现状一致。

Domain validation:
- 数学正确性即领域正确性:对已知输入断言 `symEig3x3` 的特征值/正交特征向量(轴对齐盒主轴 = 世界轴)、逐轴 distance 闭式值、自动视角方向向量。

共享面回归:
- turntable 仍能 `buildTurntable`(`fitBoundsToView` 默认调用不破坏);既有 `core/tests/camera_fit.test.ts` characterization(ac-005 对应)与所有 camera_* 测试保持绿。

## UI verification

(非绑定;真实像素/GL 行为,由 `/mol:web` 临机验证,不作 acceptance criteria。)

- 加载一个细长斜放分子,按 reset:视口中分子占满、四周留白明显小于改动前,无边缘球被裁。
- 宽屏窗口下 reset:横向铺满,左右不再有大片空白;竖屏 reset 行为与从前一致。
- 加载含 PBC 盒的轨迹,开启框盒后 reset:整盒八角均在画面内、未被裁。
- `viewDirection="auto"` reset:相机自动转到能看到最大轮廓的角度;默认 reset 仍是熟悉的 iso 角。

## Out of scope

- 不做相机动画/缓动过渡(reset 仍是瞬时设位);仅取景几何升级。
- 不改 turntable 的轨道/导出参数语义,仅让其复用升级后的 fit(OBB 接入为可选增益)。
- 不引入 molrs `WasmPca2` 做坐标 PCA(已评估:N×3 体量小,TS 内 3×3 分解更易测、无 handle 负担)。
- 不改 `getBounds()` 公开返回类型,也不改 `fitBoundsToView` 既有签名/默认数值语义(向后兼容硬约束)。
- 不处理多 source 叠加场景的"按 source 分别取景";reset 仍取全场景包围。
