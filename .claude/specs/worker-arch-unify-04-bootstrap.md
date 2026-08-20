---
title: worker-arch-unify-04-bootstrap — webview blob bootstrap 实机验证与收敛
status: approved
created: 2026-08-20
---

# worker-arch-unify-04-bootstrap — webview blob bootstrap 实机验证与收敛

## Summary

在真实 VS Code 扩展宿主里分别驱动 trajectory worker（`spawnWebviewWorkerLoadingWasm`：主线程 fetch script+wasm、`__molvisWasmWant` 握手、内联 source、posted-wasm）与 compute worker（`spawnWebviewWorkerFromHref`：纯 `import href` blob bootstrap），实录两条路径的 wasm 加载成败与网络/CSP 行为——按 webview-worker-wasm 笔记的陷阱 2，FromHref 路径 worker 侧的 `fetch(*.module.wasm)` 理应失败，而 compute worker 同样加载 molrs WASM，两者必有一个错误或过时；但现行 CSP `connect-src ${webview.cspSource} https: blob:`（`html.ts:45`）字面上放行 https CDN fetch，结论真悬而未决，必须实机裁决。验证后按预写的三分支之一收敛：`vsc-ext/src/webview/spawnWebviewWorker.ts` 只留一条 spawn 路径、单一导出 `spawnWebviewWorker`，`worker_spawner.ts`（03 交付的 alias 目标）两个函数委托同一条路径；bump `html.ts` 的 `WEBVIEW_ASSET_REV`；若验证推翻或修正陷阱 2，以 deliberate decision 同步更新 `.claude/notes/notes.md` 的 webview-worker-wasm 条目与 CLAUDE.md 的 "WASM is posted, never fetched" invariant——任何分支都不得静默。Chromium/CSP 特技全部留在 vsc-ext，不上溯 stage/core。

## Design

### 验证程序（第一等工作，先于一切代码改动）

以打包后的 vsc-ext 启动扩展开发宿主（`code --extensionDevelopmentPath` / F5），打开 webview DevTools：

1. **trajectory 路径**：打开一个 `.xyz` 或 `.lammpstrj` 轨迹文件 → LoadingWasm 生效——记录 `__molvisWasmWant` 握手、posted-wasm 注入、索引是否完成。
2. **compute 路径**：从 UI 触发一次 optimize/analysis 任务；若 webview UI 无直达入口，在 DevTools 控制台驱动 `warmComputeWorker()` 或加临时触发——**不得据"触发不到"跳过验证**（触发不到本身就是"FromHref 从未被实战检验"的证据，照记）。记录 compute worker 的 molrs wasm 异步 loader（`out/static/wasm/*.module.wasm`）fetch 的网络面板结果与 console/CSP 违规报告。

证据（每 worker 的 wasm 加载成败 + 具体错误文本/网络状态）写入 PR 文本与 notes 更新，作为分支选择依据。

### 三分支处置（预写，验证后择一执行）

- **分支 a — FromHref 的 wasm fetch 实机失败**（compute 在 webview 一直是坏的或从未被触达）：收敛到 posted-wasm。删除 `webviewWorkerBootstrap`、`spawnWebviewWorkerFromHref`；`spawnWebviewWorkerLoadingWasm` 改名为唯一导出 `spawnWebviewWorker(scriptHref, name): Promise<Worker>`；保留 `WASM_LOADER_HASH`、`wasmHrefFromWorkerScript`、`webviewWorkerWithPostedWasm`、`waitForWasmWant`。CLAUDE.md invariant **不变**；notes 条目补记 addendum：compute 曾自 2026-08 前走未经检验的 FromHref 路径，本次收敛，附证据。
- **分支 b — FromHref 实机工作**（陷阱 2 已过时，如 Chromium/CSP 行为变化）：收敛到简单路径。删除整套 posted-wasm 机器（`WASM_LOADER_HASH`、`wasmHrefFromWorkerScript`、`webviewWorkerWithPostedWasm`、`waitForWasmWant`、`spawnWebviewWorkerLoadingWasm`）；`spawnWebviewWorkerFromHref` async 化改名 `spawnWebviewWorker`（seam 签名 03 已定为 Promise）。以 deliberate decision 重写 notes 的 webview-worker-wasm 条目（保留三陷阱史料、注明何者何时被推翻、附实录证据）并更新 CLAUDE.md invariant 文本。
- **分支 c — 两者都工作但机制不同**（如 wasm fetch 经 `connect-src … https:` 放行）：裁决收敛到**更简单者**（href bootstrap，即分支 b 的代码处置），notes/CLAUDE.md 同分支 b 更新，并额外记录两条路径为何都工作（引用 `html.ts` CSP 行）。

任何分支的共同终态：`spawnWebviewWorker.ts` 单一导出 spawn 路径 + 其存活 helper；`worker_spawner.ts` 的 `spawnTrajectoryWorker`/`spawnComputeWorker` 都委托 `spawnWebviewWorker`（仅 name/href 不同）；败者机器整体删除（无 dead code 残留——iron law no silent debt）。

### 相关实体与约束

- `vsc-ext/src/extension/panels/html.ts`：`WEBVIEW_ASSET_REV` 从 `"dcd-preview-8"` bump（bootstrap 内容变更，Chromium 不得复用缓存 `shared.js`）；CSP 仅在存活路径确需时调整（分支 a 维持 `worker-src … blob:`；分支 b/c 若 posted-wasm 死亡可评估收紧 `script-src` 的 `blob:`——仅在实证安全时做，否则不动）。
- `rslib.webview.worker.config.mts` 的两个 isolated worker entry（`out/chunks/worker.js`、`out/chunks/compute-worker.js`）**不变**——本规格只改 bootstrap，不改产物布局。
- package-architecture 规则 5：收敛后的机器仍全部在 vsc-ext 包内，stage/core 零感知。
- 模块头部的 Chromium 三陷阱注释按验证结果同步改写，与 notes 条目一字不冲突。

### Reuse decision

- generalize/converge `spawnWebviewWorkerFromHref` vs `spawnWebviewWorkerLoadingWasm` —— 本规格的主体：按实证分支收敛为单一 `spawnWebviewWorker`，败者删除（librarian 的 converge 候选在此闭环）。
- reuse `worker_spawner.ts` seam（03 交付）—— 两函数改为委托收敛路径，签名不动。
- reuse `WEBVIEW_ASSET_REV` 缓存失效机制与 `buildCsp`（`html.ts`）—— bump / 按需微调，不新建机制。
- reuse 存活分支的 helper 集（a：`wasmHrefFromWorkerScript` 等四件；b/c：`webviewWorkerBootstrap`）—— 原样保留改名收编。
- pattern 守卫脚本的 readFileSync 文本锁风格（`traj-ingest-03-hud.ts` 先例）—— 回归示例依样。
- 01/02/03 交付物（core workload、TrajectoryRuntime、spawn seam）—— 本规格零触碰，不在候选内。

## Files to create or modify

- `vsc-ext/src/webview/spawnWebviewWorker.ts`
- `vsc-ext/src/webview/worker_spawner.ts`（03 交付的 alias 目标）
- `vsc-ext/src/extension/panels/html.ts`
- `vsc-ext/tests/unit/webview/spawnWebviewWorker.test.ts`
- `vsc-ext/tests/unit/webview/worker_spawner.test.ts`（03 交付，委托目标改变需同步）
- `.claude/notes/notes.md`
- `CLAUDE.md`（仅分支 b/c）
- `regressions/worker-arch-unify-04-bootstrap.ts` (new)

## Tasks

- [ ] Verify both webview worker bootstrap paths on real hardware — launch the extension development host, open a trajectory file (LoadingWasm) and drive one compute job via UI or DevTools `warmComputeWorker()` (FromHref), record per-worker wasm load outcome with console/network/CSP evidence, and select branch a / b / c
- [ ] Write failing unit tests for the converged surface (rewrite vsc-ext/tests/unit/webview/spawnWebviewWorker.test.ts to the single `spawnWebviewWorker` export and its surviving helpers; update vsc-ext/tests/unit/webview/worker_spawner.test.ts fakes to the new delegate)
- [ ] Converge vsc-ext/src/webview/spawnWebviewWorker.ts to the verified single spawn path per the selected branch, deleting the losing machinery wholesale and rewriting the module-header trap commentary
- [ ] Rewire both functions in vsc-ext/src/webview/worker_spawner.ts to delegate to the converged `spawnWebviewWorker`
- [ ] Bump `WEBVIEW_ASSET_REV` in vsc-ext/src/extension/panels/html.ts (adjust CSP only if the surviving path demonstrably requires it)
- [ ] Update the webview-worker-wasm entry in .claude/notes/notes.md with the verification record (and rewrite the CLAUDE.md "posted, never fetched" invariant iff branch b/c) as a deliberate decision
- [ ] Add regression example regressions/worker-arch-unify-04-bootstrap.ts (public API only; hard-coded goldens, no third-party runtime)
- [ ] Verify the converged build on real hardware — trajectory open and one compute job both succeed in the extension development host with the single spawn path
- [ ] Run full check + test suite

## Testing strategy

- 单元测试在 vsc-ext 包内、镜像源布局、单函数粒度；vsc-ext 自绿 = vsc-ext 包测试命令，不依赖真实 webview。
- `vsc-ext/tests/unit/webview/spawnWebviewWorker.test.ts`（重写为存活面）：分支 a——保留/收编现有 posted-wasm 用例（loader-hash 解析硬编码金标 `"3664ff7258.module.wasm"`、prefix 含 `__molvisWasmWant`/不含 `import(`/wasm 不落 fetch、`waitForWasmWant` 握手与超时拒绝），删除 bootstrap-import 用例；分支 b/c——保留 bootstrap 字面金标用例（`import "<href>";\n`），删除全部 posted-wasm 机器用例。共同断言：模块恰导出一个 spawn 入口 `spawnWebviewWorker` 且返回 Promise。
- `vsc-ext/tests/unit/webview/worker_spawner.test.ts`（更新委托目标）：以模块假件断言 trajectory/compute 两函数都调用 `spawnWebviewWorker`，仅 `(href, name)` 实参不同（硬编码 `"trajectory-xyz"` / `"molvis-compute"`）。
- 实机验证（收敛前后各一次）无法进单测——按 evaluator protocol 落为两条 `type: runtime` 手动/agent 驱动判据（ac-001、ac-007），`pass_when` 指名可观察状态（扩展宿主内轨迹打开成功、compute 任务完成、DevTools 无 wasm fetch 失败），证据实录进 PR 文本与 notes。
- 回归示例：`regressions/worker-arch-unify-04-bootstrap.ts`（仓库根，node 直跑，沿 `traj-ingest-03-hud.ts` 的 readFileSync 文本锁先例，零 WASM）——硬编码金标：`spawnWebviewWorker.ts` 文本恰含一个 `export function spawnWebviewWorker` 或 `export async function spawnWebviewWorker` 且败者符号（分支 a：`spawnWebviewWorkerFromHref`；分支 b/c：`webviewWorkerWithPostedWasm`——实施时按选定分支落定其一并写为字面量）不再出现；`worker_spawner.ts` 文本含两处 `spawnWebviewWorker(` 委托；`html.ts` 不再含旧值字面量 `"dcd-preview-8"` 且仍含 `worker-src ${webview.cspSource} blob:`；notes.md 含 `<!-- mol:note:topic:webview-worker-wasm -->` 且含本次验证日期。金标为本规格自定义字面量，无第三方 oracle。
- 项目门：`biome check . && npm run typecheck`、根 `npm test`。

## Out of scope

- `rslib.webview.worker.config.mts` 的 isolated worker entry 与产物布局（`out/chunks/*`、`out/static/wasm/*`）——不动。
- 03 交付的 alias 接线（`resolve.alias`、`./worker-spawner` 出口）与 stage/core 任何文件——冻结；Chromium/CSP 特技不上溯。
- Jupyter 路径（browser 路径 + `__MOLVIS_ASSET_BASE__` publicPath 覆盖 + kernel CORS 头）——主请求明确排除。
- CSP 的一般性收紧（超出存活路径所需的最小调整）。
- compute/trajectory worker 内核逻辑（01/02 已定形）。
