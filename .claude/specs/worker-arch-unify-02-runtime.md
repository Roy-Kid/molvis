---
title: worker-arch-unify-02-runtime — TrajectoryRuntime 重建在 workload 信道上
status: approved
created: 2026-08-20
---

# worker-arch-unify-02-runtime — TrajectoryRuntime 重建在 workload 信道上

## Summary

把 `stage/src/transport/trajectory_worker/` 的主线程侧（`TrajectoryRuntime`，545 行）与 worker 侧（`worker.ts`）重建在 01 落地的 core workload 扩展信道上，删除 stage 内手写的第二套 worker 生命周期实现：ready 门控（`worker-heartbeat` 收敛为 workload `{type:"ready"}`）、pending map、request-bytes/fetchId 手工关联（类型化为反向 host-call）、以及构造器 30s 超时（收敛为 `readyTimeoutMs`，同时删除 `awaitComputeHostReady` 的 `Promise.race` 定时器——boot 心跳 onBeat UI 保留）。对外行为不变：`open()` 首帧提前 resolve、`whenIndexComplete`、`loadFrameLatest` latest-wins 以 `CancellationError` 拒绝、"copy into packed buffer before transfer"（VS Code IPC pooled buffer 坑）语义逐位保留；`./trajectory-runtime` 上被 vsc-ext / io / page 消费的全部符号形状不变，`runtime.ts` 文件留在原位原名（NormalModuleReplacementPlugin 正则在 03 退役前仍匹配它）。唯一对外可见的变更是 `./trajectory-protocol` 删除随手写协议一同死亡的 wire 类型（`OpenRequest`/`BytesResponse`/`WorkerHeartbeat` 等）——公共子路径按 breaking 对待，本规格明示此 deliberate decision，不静默。

## Design

### 实体与改动

**`stage/src/transport/trajectory_worker/protocol.ts` —— 从 wire 协议改为 job 类型（重写）**

手写消息信封死亡，模块转为 workload 信道的类型化参数：

- 保留不动：`Format`、`SourceHandle`（`BlobSourceHandle`/`OpfsSourceHandle`）、frame 载荷类型（`ColumnPayload`/`BlockPayload`/`BoxPayload`/`GridPayload`/`FrameMessage`）、`frameMessageTransferList`。`FrameMessage` 形状原样保留（含 `kind`/`requestId` 字段），使 `frame_codec.ts` 零改动 reuse。
- 新增 `TrajectoryJob`（`TJob`）：`{ kind: "open"; source: SourceHandle; format: Format; chunkSize?; fingerprint? } | { kind: "load-frame"; frameId: number } | { kind: "close" }`。
- 新增 `TrajectoryJobResult`（`TResult`）：`{ kind: "open-result"; frameCount: number; totalBytes: number; indexComplete: boolean } | FrameMessage | { kind: "closed" }`。
- 新增 `TrajectoryIndexProgress`（`TProgress`）：`{ bytesScanned; totalBytes; framesIndexedSoFar }`。
- `RequestBytes` 重塑为 host-call 载荷 `{ byteOffset: number; byteLen: number }`（`THostCall`）；应答 `THostReply = ArrayBuffer`。`kind`/`fetchId` 字段死亡——关联由信道的 callId 承担。
- **删除**（deliberate breaking on `./trajectory-protocol`）：`OpenRequest`、`LoadFrameRequest`、`CancelRequest`、`CloseRequest`、`BytesResponse`、`WorkerRequest`、`WorkerResponse`、`IndexProgress`、`IndexReady`、`OpenError`、`FrameError`、`ClosedAck`、`WorkerHeartbeat`。vsc-ext 从该子路径只消费 `Format`，不受影响。

字节安全上限（safe-int / 1 TB）与 transfer 所有权规则的模块级文档保留。

**`stage/src/transport/trajectory_worker/runtime.ts` —— `TrajectoryRuntime` 重建（文件原位原名）**

- 公共面逐位保留：构造器 `(worker: WorkerLike, format: Format)`、`open`、`loadFrame`、`loadFrameLatest`、`whenIndexComplete`、`cancelOpen`、`cancel(id)`、`close`、`OpenResult`、`OpenOptions`、`IndexProgressCallback`、`WorkerLike`、`CancellationError`、`spawnTrajectoryWorker`。`spawnTrajectoryWorker` 本体与其字面 `new Worker(new URL("./worker.js", import.meta.url))` **一字不动**（归 03）。
- 内部以 `WorkloadHost<TrajectoryJob, TrajectoryJobResult, TrajectoryIndexProgress, RequestBytes, ArrayBuffer>` 替换手写 pending map / `workerReady` 承诺 / 构造器 30s 定时器 / `dispatch` / `serveBytes`：
  - 构造器内 `new WorkloadHost({ name: \`trajectory-${format}\`, createWorker: () => adapter, readyTimeoutMs: 30_000, onHostCall })`。
  - 新增模块私有 `WorkerLikeAdapter`：`WorkloadHost` 消费 `onmessage`/`onerror` 属性型 Worker，而公共 `WorkerLike` 是 addEventListener 型且形状冻结——适配器把属性 setter 桥接到 `addEventListener` 并转发 `postMessage`/`terminate`。不出 barrel。
  - `onHostCall`：调 `TrajectorySource.readRange(byteOffset, byteOffset + byteLen)`（**seam 形状不变**，traj-ingest-04/05 依赖），校验 `Uint8Array`，先复制进 packed buffer 再 `{ result: packed.buffer, transfer: [packed.buffer] }` 零拷贝传回——pooled buffer 注释与语义逐字保留；无 source 或读错时抛错，由信道转为 `ok: false` 应答。
  - `open()`：`submit(openJob, { onProgress, earlyResolve, cancelMode: "reject" })`；`earlyResolve` 在 `framesIndexedSoFar >= 1` 时返回提前 `open-result`（`indexComplete: false`）；`ticket.result` 映射为 `OpenResult`（提前时 `length: null`）；`ticket.completion` 驱动 `onIndexComplete`、`whenIndexComplete` 等待者与 `lastIndexComplete` 缓存。"another open is in flight" 守卫保留。
  - `loadFrame`/`loadFrameLatest`：`submit(loadFrameJob, { cancelMode: "reject" })`，`ticket.id` 即关联 id；latest-wins 取消上一 in-flight id 后再提交。done 载荷经 `rehydrateFrame` 还原为 molrs `Frame`（调用方所有权、经 `Trajectory` LRU——molrs-handles 规则不变，信道不产生同一逻辑实体的第二个 molrs 对象）。
  - **错误裁决**：stage `CancellationError` 类原样保留为公共错误（`io/index.ts` 与 `page/format-picker-dialog.tsx` 靠 `instanceof` 判定，`stage/src/system.ts` 的 `_navigateTo` 靠 loadId 判过期、不判类型）。`TrajectoryRuntime` 在自身边界把信道的 `WorkloadCancelledError` 拒绝翻译为 `new CancellationError(ticket.id)`——`WorkloadCancelledError` 不逃出本模块，不设别名再导出。
  - `close()`：fire-and-forget 提交 `{kind:"close"}` job（worker 释放 WASM 流与 source），随后 `host.dispose()` 终止并拒绝在飞请求（现行"polite close + terminate 兜底"语义保留；ready 前 close 的提交失败吞掉）。

**`stage/src/transport/trajectory_worker/worker.ts` —— worker 侧重建**

- 顶层改为 `installWorkloadHandler({ scheduling: "interleaved", run: dispatchJob })`：长索引 job 流式进行的同时服务 load-frame，正是 01 交付的第二调度模式。手写 `messageHandler`、`worker-heartbeat`、`pendingFetches`/`fetchBytes`/`rejectPendingFetches`、`cancelledOpenId`/`cancelledFrameIds` 全部删除。
- `dispatchJob` 按 `job.kind` 分发到既有 `handleOpen`/`handleLoadFrame`/`handleClose` 改造体：索引循环每 chunk 查 `ctx.isCancelled()`（取代 `cancelledOpenId`），load-frame 在 await 边界查 `ctx.isCancelled()`（取代 `cancelledFrameIds`）；进度经 `ctx.reportProgress`（信道心跳兜底空窗）；frame 结果以 `{ result: frameMessage, transfer: frameMessageTransferList(frameMessage) }` 返回。
- `MainThreadBlobSource.readRange` 改走 `ctx.callHost({ byteOffset, byteLen })`（open job 构造 source 时捕获该 job 的 `callHost`；callId 关联与 job 无关，后续 load-frame 复用同一 source 合法）。WASM 索引/解码仍全部经 `streams.ts` 的 MolRS 流——molrs-traj-streaming invariant 不动，host 侧无任何扫描器。
- 输出抽取热路径（`readBlocks`/`readBox`/`writeIntoWasm` 的"每次 wasm 调用后重取 view"纪律）原样保留。

**`stage/src/transport/trajectory_worker/index.ts`** —— barrel 同步：保留 `rehydrateFrame`、`frameMessageTransferList`、`CancellationError`、`TrajectoryRuntime`、`WorkerLike`、`OpenOptions`、`OpenResult`、`IndexProgressCallback`、`spawnTrajectoryWorker`、`Format`、`SourceHandle`、frame 载荷类型、`FrameMessage`；新增 job/progress 类型导出；死亡 wire 类型随 protocol 删除。

**`stage/src/compute/runtime.ts` —— ready 超时上收（compute 半边）**

- singleton 工厂的 `new WorkloadHost({...})` 增 `readyTimeoutMs: 30_000`（`READY_TIMEOUT_MS` 常量随之内联进选项）。
- `awaitComputeHostReady` 删除 `Promise.race` 与内部 `setTimeout`，保留 2s onBeat 心跳 + `await host.whenReady()`（超时拒绝现在来自 host，错误信息由 host `[name]` 前缀承载）；签名与导出不变，`optimize/worker_client.ts` 与 `analysis/worker_client.ts` 两个调用方零改动。

### 生命周期与所有权

Worker realm 内 WASM 流（indexStream/parseStream）与 source 归 worker state 所有，`close` job 释放；主线程 `Frame` 由 `rehydrateFrame` 产出、调用方所有、经 `Trajectory` LRU `free()`——与 molrs-handles 笔记一致，本次重建不引入同一逻辑实体的第二个 molrs 对象。`WorkloadHost` 实例归 `TrajectoryRuntime` 私有，随 `close()` dispose；每文件一个 runtime 的既有生命周期不变。

### Reuse decision

- reuse `WorkloadHost`/`submit`/`WorkloadJobTicket`/`earlyResolve`/`cancelMode: "reject"`/`readyTimeoutMs`/`onHostCall`（01 交付）——本规格纯消费，不再泛化。
- reuse `installWorkloadHandler` + `scheduling: "interleaved"` + `ctx.callHost`（01 交付）——worker 侧纯消费。
- reuse `frame_codec.ts`（`rehydrateFrame` + `frameMessageTransferList`）——原样，零改动。
- reuse `streams.ts`（`makeStream`/`MolrsTrajStream`）——原样，零改动。
- reuse `TrajectorySource.readRange` seam——形状不变，`onHostCall` 消费。
- generalize `awaitComputeHostReady`——01 已把超时职责泛化进 `readyTimeoutMs`；本规格完成 stage 半边：删竞速定时器、留 beat。
- reuse `io/index.ts:572` `await Promise.resolve(spawnTrajectoryWorker(format))` 调用形状——零改动（03 处理）。
- pattern `stage/src/compute/` 三件套架在 core/workload 上——即本次 trajectory 重建遵循的目标形状。
- pattern spawn 字面 `new Worker(new URL(...))` / package.json 子路径出口先例——归 03，本规格不触碰。
- generalize/converge `spawnWebviewWorkerFromHref` vs `LoadingWasm`——归 04，本规格不触碰。
- new — `WorkerLikeAdapter`（模块私有）：`WorkloadHost` 需属性型 Worker 面，公共 `WorkerLike` 是冻结的 addEventListener 型，无既有候选可桥接。
- new — `TrajectoryJob`/`TrajectoryJobResult`/`TrajectoryIndexProgress`：通用信封的领域类型化参数，取代死亡 wire 类型；命名随 compute 栈先例（`ComputeJob`/`ComputeResult`/`ComputeProgress`）。

## Files to create or modify

- `stage/src/transport/trajectory_worker/protocol.ts`
- `stage/src/transport/trajectory_worker/runtime.ts`
- `stage/src/transport/trajectory_worker/worker.ts`
- `stage/src/transport/trajectory_worker/index.ts`
- `stage/src/compute/runtime.ts`
- `stage/tests/transport/trajectory_worker/runtime.test.ts`
- `stage/tests/compute/runtime.test.ts` (new)
- `regressions/worker-arch-unify-02-runtime.ts` (new)

## Tasks

- [ ] Write failing unit tests for the rebuilt TrajectoryRuntime (rewrite stage/tests/transport/trajectory_worker/runtime.test.ts — fake WorkerLike speaking the workload envelope: early-resolve open golden, whenIndexComplete/onIndexComplete, loadFrameLatest latest-wins rejects CancellationError, cancelOpen, onHostCall readRange packed-copy incl. pooled-view case, 30s ready-timeout rejection)
- [ ] Write failing unit tests for awaitComputeHostReady timeout absorption (stage/tests/compute/runtime.test.ts (new) — beat cadence kept, rejection propagates from host.whenReady, no internal 30s race under fake timers)
- [ ] Rewrite stage/src/transport/trajectory_worker/protocol.ts (TrajectoryJob/TrajectoryJobResult/TrajectoryIndexProgress + RequestBytes host-call payload; keep Format/SourceHandle/frame payloads/FrameMessage/frameMessageTransferList; delete dead wire types — declared breaking on ./trajectory-protocol)
- [ ] Rebuild `TrajectoryRuntime` in stage/src/transport/trajectory_worker/runtime.ts on WorkloadHost (WorkerLikeAdapter, onHostCall packed-copy transfer, earlyResolve open, cancelMode "reject" with WorkloadCancelledError→CancellationError translation, readyTimeoutMs 30_000; file stays at exact path/name; spawnTrajectoryWorker and its literal new Worker untouched)
- [ ] Rebuild stage/src/transport/trajectory_worker/worker.ts on installWorkloadHandler (scheduling "interleaved", job dispatch open/load-frame/close, ctx.callHost byte fetches, ctx.isCancelled replaces cancelledOpenId/cancelledFrameIds, delete worker-heartbeat and manual pendingFetches)
- [ ] Update barrel stage/src/transport/trajectory_worker/index.ts (preserve all externally consumed exports; drop dead wire types; export new job/progress types) and document changed public surface per jsdoc-tiered
- [ ] Absorb the ready timeout in stage/src/compute/runtime.ts (readyTimeoutMs: 30_000 in the singleton factory; awaitComputeHostReady keeps onBeat, drops Promise.race timer; signature unchanged)
- [ ] Add regression example regressions/worker-arch-unify-02-runtime.ts (public API only; hard-coded goldens, no third-party runtime)
- [ ] Verify zero modifications outside stage/ and regressions/ (vsc-ext, page, core, stage/src/io untouched; `git diff --name-status` shows runtime.ts modified in place, never renamed/moved — NormalModuleReplacementPlugin regex must still match until 03)
- [ ] Run full check + test suite

## Testing strategy

- 单元测试全部在 stage 包内，镜像源布局，每个测试针对单一方法；stage 自绿门 = stage 包 `rstest run`，不依赖全套件、不依赖真实 worker（`WorkerLike` 假件注入是既有先例）。
- `stage/tests/transport/trajectory_worker/runtime.test.ts`（重写为新信道语义，假 worker 改讲 workload 信封：`{type:"ready"}`/`progress`/`done`/`error`/`host-call`）：快乐路径——`open` 在首条 `framesIndexedSoFar >= 1` 的 progress 上提前 resolve，硬编码金标 `{ frameCount: 2, indexedLength: 2, length: null, indexComplete: false, totalBytes: 1024 }`；`ticket.completion` 到达后 `whenIndexComplete`/`onIndexComplete` 收到 `indexComplete: true` 终值；`loadFrame` done 载荷经 `rehydrateFrame` 还原（沿用现测试的 WASM setup）。边缘——`cancelOpen` 使 `open` 以 `name === "CancellationError"` 拒绝（现测试语义保留）；`loadFrameLatest` 连发两次，第一承诺拒绝 `instanceof CancellationError`、第二正常 resolve；`WorkloadCancelledError` 不出现在任何拒绝值中；`onHostCall` 收到 `{byteOffset, byteLen}` 后调 `readRange`，pooled-view（大 buffer 上的偏移视图）用例断言应答字节逐位等于硬编码序列且 buffer 在 transfer 清单里；worker 不发 ready 时假时钟推 30s，`open` 拒绝；`close()` 后 `loadFrame` 拒绝。
- `stage/tests/compute/runtime.test.ts`（新，镜像 `src/compute/runtime.ts`）：`awaitComputeHostReady` 快乐路径——host `whenReady` 立即 resolve 时不调 `onBeat`；慢 boot 下假时钟推 2s 收到一次 beat；边缘——host `whenReady` 拒绝（即上收后的超时来源）时 beat interval 被清且拒绝原样传播；假时钟推 30s+ 而 `whenReady` 悬置时函数自身不再产生拒绝（竞速定时器确已删除）。
- 回归示例：`regressions/worker-arch-unify-02-runtime.ts`（仓库根，node 直跑，沿 `worker-catalog-dispatch-01-seams.ts` 的 `.wasm` stub 前导先例保持零 WASM 实例化）——只经 `@molcrafts/molvis-stage/trajectory-runtime` 公共子路径构造 `TrajectoryRuntime` + 假 `WorkerLike`，断言硬编码金标：提前 `OpenResult` 字面量（同上）、latest-wins 拒绝 `name === "CancellationError"`、`host-call` 应答字节字面量 `[1, 2, 3, 4]`。金标为本规格自定义字面量，无第三方 oracle。
- 项目门：`biome check . && npm run typecheck`、根 `npm test`。

## Out of scope

- spawn seam：`stage/src/worker_spawner.ts`、`./worker-spawner` 出口、`stage/src/io/index.ts:572` 调用点、vsc-ext `resolve.alias`、`rslib.webview.worker-rewrites.mts` 退役、`regressions/traj-ingest-03-hud.ts:66` 字面串守卫更新——全部归 03；`runtime.ts` 因此必须原位原名。
- vsc-ext blob bootstrap 验证与收敛、`WEBVIEW_ASSET_REV`、notes/CLAUDE.md invariant 更新——归 04。
- `frame_codec.ts`、`streams.ts`、`.molidx` sidecar 逻辑（`molidx_codec`/`opfs_index_cache`）——原样 reuse，零改动。
- `TrajectorySource.readRange` seam 形状与 host-range sources（traj-ingest-04/05 在途链）。
- core/workload 的任何再扩展——01 已冻结本轮 core 面。
