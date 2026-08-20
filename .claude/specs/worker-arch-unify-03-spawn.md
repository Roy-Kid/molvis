---
title: worker-arch-unify-03-spawn — 单一 spawn seam 与 rewrites 退役
status: approved
created: 2026-08-20
---

# worker-arch-unify-03-spawn — 单一 spawn seam 与 rewrites 退役

## Summary

把 stage 两处字面 `new Worker(new URL(..., import.meta.url))`（trajectory 在 `transport/trajectory_worker/runtime.ts`、compute 在 `compute/spawn.ts`）收拢进新建的单一模块 `stage/src/worker_spawner.ts`，以 `@molcrafts/molvis-stage/worker-spawner` 公共子路径出口（types+import+default 双条目映射 dist，先例 `./trajectory-runtime`），签名统一 async。stage 内部消费方（`io/index.ts`、`compute/runtime.ts`）改经包名自引用消费该子路径——这正是让 vsc-ext 一行 `resolve.alias` 就能整体替换实现的机制：seam 以唯一稳定 specifier 出现在 request 层，stage 内部文件布局从此不再是 vsc-ext 构建配置的隐性 API。vsc-ext 侧合并出 alias 目标模块 `vsc-ext/src/webview/worker_spawner.ts`（内部仍走既有两条 blob 路径，04 才收敛），`rslib.webview.worker-rewrites.mts` 整文件退役、两个 webview 配置移除其引用。`io/index.ts:572` 的 `await Promise.resolve(...)` 容忍补丁删除。两处 declared breaking（不静默）：`./trajectory-runtime` 与 stage barrel 不再导出 `spawnTrajectoryWorker`，`compute` barrel 不再导出 `spawnComputeWorker`——均迁至 `./worker-spawner`。`regressions/traj-ingest-03-hud.ts` 与 `regressions/worker-catalog-dispatch-01-seams.ts` 两个守卫经核实零改动仍绿（HUD 守卫 grep 的子串 `spawnTrajectoryWorker(format)` 在新调用文本中原样保留，顺序约束不受影响）。

## Design

### 实体与新符号

**`stage/src/worker_spawner.ts`（新）—— 唯一 spawn 模块**

- `export async function spawnTrajectoryWorker(format: Format): Promise<TrajectoryRuntime>` —— 字面 `new Worker(new URL("./transport/trajectory_worker/worker.js", import.meta.url), { type: "module", name: \`trajectory-${format}\` })`，包装为 `TrajectoryRuntime`（02 交付形状）。
- `export async function spawnComputeWorker(): Promise<Worker>` —— 字面 `new Worker(new URL("./compute/worker.js", import.meta.url), { type: "module", name: "molvis-compute" })`。
- **URL 相对路径随文件位置换算**：rslib bundleless 转译使 dist 镜像 src，本文件位于 `dist/worker_spawner.js`（包根），故两个 URL 必须写 dist 相对路径 `./transport/trajectory_worker/worker.js` 与 `./compute/worker.js`（不再是旧文件里的 `./worker.js`）。rspack 只在看到字面 `new Worker(new URL(...))` 的文件内折叠 worker chunk——两个字面都必须留在本文件内，注释保留旧模块的 ESM/`workerChunkLoading: "import"` 告诫。
- `export class DeferredWorker` —— async spawn → 同步 Worker 面的桥接：构造入参 `Promise<Worker>`；同步暴露 `onmessage`/`onerror` setter、`postMessage`（内层未就绪时入队，就绪后按序冲刷）、`terminate`；spawn Promise 拒绝时向 `onerror` 合成 error 事件（走 `WorkloadHost.failAll` 既有路径，`readyTimeoutMs` 为兜底）。存在理由：01 冻结了 core 面，`WorkloadHostOptions.createWorker: () => Worker` 是同步工厂；异步化在 stage 侧解决，`getComputeRuntime()`/`createWorkloadSingleton`/两个 worker_client 调用方全部零改动。
- 旧 `_assertWorkerCtor` 守卫收编进本模块。

**`stage/package.json`** —— exports 增：

```json
"./worker-spawner": {
  "types": "./dist/worker_spawner.d.ts",
  "import": "./dist/worker_spawner.js",
  "default": "./dist/worker_spawner.js"
}
```

新子路径属公共 API。stage 根 barrel（`src/index.ts`）不转出 spawn 函数（现状仅出 `warmComputeWorker`，不变）——`worker-catalog-dispatch-01-seams.ts` 锁的 barrel 面不受影响。

**旧位置退役（declared breaking，不静默）**

- `stage/src/transport/trajectory_worker/runtime.ts`：删除 `spawnTrajectoryWorker` 与 `_assertWorkerCtor`（`logger` import 若仅此使用一并删）；`TrajectoryRuntime` 本体不动。`./trajectory-runtime` 子路径与 `trajectory_worker/index.ts` barrel 不再导出 `spawnTrajectoryWorker`——公共面 breaking，本规格明示；03 落地同时 vsc-ext 唯一消费方已迁走，无悬空消费。
- `stage/src/compute/spawn.ts`：整文件删除；`compute/index.ts` 删 `export { spawnComputeWorker } from "./spawn"`（breaking on compute barrel，同样明示）。

**stage 内部消费改自引用子路径**

- `stage/src/io/index.ts`：`import { spawnTrajectoryWorker } from "@molcrafts/molvis-stage/worker-spawner"`；调用点改 `const runtime = await spawnTrajectoryWorker(format);`（`Promise.resolve` 补丁删除）。守卫核实：`traj-ingest-03-hud.ts:66` 以 `indexOf("spawnTrajectoryWorker(format)")` 匹配，新文本仍含该子串且仍在 `indexComplete: false` HUD 发射之后——**守卫文件零改动**，此结论作为验证任务明示，不是静默假设。
- `stage/src/compute/runtime.ts`：`import { DeferredWorker, spawnComputeWorker } from "@molcrafts/molvis-stage/worker-spawner"`；singleton 工厂 `createWorker: () => new DeferredWorker(spawnComputeWorker()) as unknown as Worker`。
- 自引用（Node package self-reference，`name` + `exports` 已具备）解析到本包 dist——与 vsc-ext 消费同一条 exports 映射，保证 alias 在所有图（page rsbuild、webview rspack、node regressions）里拦截同一个 specifier。stage 单测不真调 spawn（旧模块本就注明 "Tests should NOT call this"），`DeferredWorker` 以 src 直导单测。

**vsc-ext 侧**

- `vsc-ext/src/webview/worker_spawner.ts`（新，alias 目标）：导出与 stage 出口**签名完全一致**的两函数——`spawnTrajectoryWorker` 迁自现 `spawnTrajectoryWorker.ts`（`spawnWebviewWorkerLoadingWasm` + `new TrajectoryRuntime(worker as WorkerLike, format)`），`spawnComputeWorker` 迁自现 `spawnComputeWorker.ts` 并 async 化（内部仍 `spawnWebviewWorkerFromHref`，收敛归 04）。类型自 `@molcrafts/molvis-stage/trajectory-runtime` / `/trajectory-protocol`（02 保留面）。
- 删除 `vsc-ext/src/webview/spawnTrajectoryWorker.ts`、`spawnComputeWorker.ts`（已核实 vsc-ext 内无其他 import 方；其类型再导出无消费者）。
- `rslib.webview.config.mts` 与 `rslib.webview.page.config.mts`：删除 `worker-rewrites` import 与两个 Rewrite 实例/plugin 挂载；`resolve.alias` 增精确匹配一行（page 配置并入既有 alias 块）：

```ts
"@molcrafts/molvis-stage/worker-spawner$": path.resolve(
  import.meta.dirname, "./src/webview/worker_spawner.ts"),
```

- `rslib.webview.worker-rewrites.mts` 整文件删除——原始请求正则、context 后缀判断、"raw request not resolved path" 告诫全部随之死亡。
- Chromium/CSP 特技不上溯：alias 目标在 vsc-ext 包内，stage/core 无任何 webview 知识——package-architecture 规则 5 保持（core/stage 不知晓 vsc-ext）。

### 生命周期与所有权

`DeferredWorker` 归 compute host 所有（`createWorker` 返回后由 `WorkloadHost` 持有、`dispose()` 时 `terminate` 级联终止内层或放弃未就绪 spawn）。spawn 函数无状态、每调用产新 Worker/Runtime——不是工厂模式替代构造器：`TrajectoryRuntime`/`WorkloadHost` 的构造故事不变，spawn 只是"字面 URL 必须集中存放"这一 bundler 物理约束的载体。

### Reuse decision

- reuse `TrajectoryRuntime`（02 交付）—— stage/vsc-ext 两个 spawner 都构造它，形状不动。
- reuse `spawnWebviewWorkerLoadingWasm` / `spawnWebviewWorkerFromHref` —— vsc-ext spawner 原样委托；两路径的收敛（generalize/converge 候选）**明示移交 04**，本规格不动 `spawnWebviewWorker.ts`。
- reuse `WorkloadHostOptions.createWorker` 同步工厂形状（01 冻结的 core 面）—— 以 `DeferredWorker` 桥接消费，不改 core。
- reuse `io/index.ts:572` 调用形状 —— 签名真 async 化后 `await Promise.resolve` 补丁简化为直接 `await`（librarian 注 "call shape already async-tolerant" 的收尾）。
- pattern `compute/spawn.ts` 字面 `new Worker(new URL(...))` —— 形式逐字保留、迁入 `worker_spawner.ts`（含 ESM worker-chunk 注释），原文件退役。
- pattern stage `package.json` 子路径出口先例（`./trajectory-runtime` types+import 双条目）—— `./worker-spawner` 依样。
- pattern `spawn<X>Worker` 命名、kebab-case 子路径 —— 遵循。
- new — `DeferredWorker`：无既有候选桥接 async spawn 与同步 `createWorker` 工厂；命名/构造随 stage 类先例（构造注入、`[molvis-compute]` 前缀错误经 host 走既有 error 路径）。
- new — `stage/src/worker_spawner.ts` 与 `vsc-ext/src/webview/worker_spawner.ts` 模块本体：librarian 定位裁决即"单一 stage 模块 + 单一子路径出口"（rejected two modules/two aliases — drift recurs）。

## Files to create or modify

- `stage/src/worker_spawner.ts` (new)
- `stage/package.json`
- `stage/src/transport/trajectory_worker/runtime.ts`
- `stage/src/transport/trajectory_worker/index.ts`
- `stage/src/compute/spawn.ts`（删除）
- `stage/src/compute/index.ts`
- `stage/src/compute/runtime.ts`
- `stage/src/io/index.ts`
- `stage/tests/worker_spawner.test.ts` (new)
- `vsc-ext/src/webview/worker_spawner.ts` (new)
- `vsc-ext/src/webview/spawnTrajectoryWorker.ts`（删除）
- `vsc-ext/src/webview/spawnComputeWorker.ts`（删除）
- `vsc-ext/rslib.webview.config.mts`
- `vsc-ext/rslib.webview.page.config.mts`
- `vsc-ext/rslib.webview.worker-rewrites.mts`（删除）
- `vsc-ext/tests/unit/webview/worker_spawner.test.ts` (new)
- `regressions/worker-arch-unify-03-spawn.ts` (new)

## Tasks

- [ ] Write failing unit tests for DeferredWorker (stage/tests/worker_spawner.test.ts (new) — postMessage buffering then ordered flush, onmessage/onerror forwarding, terminate before/after inner resolves, spawn rejection synthesizes an error event)
- [ ] Implement stage/src/worker_spawner.ts (new) — both literal `new Worker(new URL(...))` spawns with dist-relative URLs `./transport/trajectory_worker/worker.js` / `./compute/worker.js`, async signatures, DeferredWorker — and add the `./worker-spawner` types+import+default entry to stage/package.json
- [ ] Retire old spawn locations — delete `spawnTrajectoryWorker`/`_assertWorkerCtor` from stage/src/transport/trajectory_worker/runtime.ts and its export from stage/src/transport/trajectory_worker/index.ts; delete stage/src/compute/spawn.ts and its export from stage/src/compute/index.ts (declared breaking on ./trajectory-runtime and the compute barrel)
- [ ] Rewire stage consumers to the self-referenced subpath — stage/src/io/index.ts imports `@molcrafts/molvis-stage/worker-spawner` and replaces `await Promise.resolve(spawnTrajectoryWorker(format))` with `await spawnTrajectoryWorker(format)`; stage/src/compute/runtime.ts bridges `spawnComputeWorker()` through DeferredWorker into the sync createWorker factory
- [ ] Write failing unit tests for the vsc-ext alias module (vsc-ext/tests/unit/webview/worker_spawner.test.ts (new) — both exports are async functions with seam-identical signatures; compute path delegates to spawnWebviewWorkerFromHref, trajectory path to spawnWebviewWorkerLoadingWasm, via module fakes)
- [ ] Implement vsc-ext/src/webview/worker_spawner.ts (new) delegating to the existing spawnWebviewWorker paths, and delete vsc-ext/src/webview/spawnTrajectoryWorker.ts and spawnComputeWorker.ts
- [ ] Replace rewrites with the alias — add the exact-match `"@molcrafts/molvis-stage/worker-spawner$"` resolve.alias line to vsc-ext/rslib.webview.config.mts and vsc-ext/rslib.webview.page.config.mts, remove their worker-rewrites imports/instances, and delete vsc-ext/rslib.webview.worker-rewrites.mts
- [ ] Verify guards unmodified and green — `node regressions/traj-ingest-03-hud.ts` (HUD-before-spawn substring preserved) and `node regressions/worker-catalog-dispatch-01-seams.ts` (stage barrel leaks no worker kernel) both pass with zero edits to those files
- [ ] Add regression example regressions/worker-arch-unify-03-spawn.ts (public API only; hard-coded goldens, no third-party runtime)
- [ ] Run full check + test suite

## Testing strategy

- 单元测试各归各包、镜像源布局，单函数粒度；stage 自绿 = stage 包 `rstest run`，vsc-ext 自绿 = vsc-ext 包测试命令。
- `stage/tests/worker_spawner.test.ts`（新，镜像 `src/worker_spawner.ts`，只测 `DeferredWorker`——两个 spawn 函数真起 Worker，沿旧模块 "Tests should NOT call this" 惯例不在单测中调用）：快乐路径——内层 resolve 前 `postMessage` 三条入队，resolve 后按原序冲刷（硬编码顺序 `["a","b","c"]`）；`onmessage`/`onerror` 在内层就绪前赋值、就绪后收到转发事件。边缘——内层 resolve 前 `terminate()` 使后到内层立即终止且不冲刷；spawn Promise 拒绝时 `onerror` 收到合成 error 事件（message 含拒绝原因）。
- `vsc-ext/tests/unit/webview/worker_spawner.test.ts`（新，镜像 `src/webview/worker_spawner.ts`）：以模块假件替换 `./spawnWebviewWorker`——`spawnComputeWorker()` 返回 Promise 且以 `("…/compute-worker.js" href, "molvis-compute")` 委托 FromHref；`spawnTrajectoryWorker("xyz")` 以 `("…/worker.js" href, "trajectory-xyz")` 委托 LoadingWasm 并返回 `TrajectoryRuntime` 实例。
- 守卫（零改动验证，属 Tasks 而非文件改动）：`regressions/traj-ingest-03-hud.ts`、`regressions/worker-catalog-dispatch-01-seams.ts` 直跑通过。
- 回归示例：`regressions/worker-arch-unify-03-spawn.ts`（仓库根，node 直跑，沿 seams 脚本 `.wasm` stub + DOM shim 前导，零 WASM）——只经包公共面锁 seam 形状，硬编码金标为字面量清单：`import("@molcrafts/molvis-stage/worker-spawner")` 恰好导出 `["DeferredWorker", "spawnComputeWorker", "spawnTrajectoryWorker"]` 且两个 spawn 均为 async function；`import("@molcrafts/molvis-stage/trajectory-runtime")` **不再**含 `spawnTrajectoryWorker`（锁死 declared breaking，防止回潜）；读 `vsc-ext/rslib.webview.config.mts` 与 `rslib.webview.page.config.mts` 文本断言含 `worker-spawner$` alias 键且不含 `worker-rewrites`（锁 rewrites 不复活）。金标为本规格自定义字面量，无第三方 oracle。
- 项目门：`biome check . && npm run typecheck`、根 `npm test`。

## Out of scope

- vsc-ext 两条 blob bootstrap 路径（`spawnWebviewWorkerLoadingWasm` / `spawnWebviewWorkerFromHref`）的实机验证与收敛、`spawnWebviewWorker.ts` 的任何改动、`html.ts` 的 `WEBVIEW_ASSET_REV` bump、notes / CLAUDE.md invariant 更新——全部归 04（本规格未改 bootstrap 内容，仅改接线）。
- core/workload 与 `TrajectoryRuntime` 本体——01/02 已冻结。
- page / python 宿主——它们经 stage dist 折叠字面 spawn，自动随迁，零改动。
- `./trajectory-worker`、`./compute-worker` worker-entry 子路径出口——保持原样（webview worker 独立构建仍消费）。
- Jupyter 路径（主请求已排除）。
