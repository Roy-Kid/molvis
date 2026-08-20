---
title: worker-arch-unify-01-channel — core workload 信道扩展
status: approved
created: 2026-08-20
---

# worker-arch-unify-01-channel — core workload 信道扩展

## Summary

就地扩展 `core/src/workload/`（`@molcrafts/molvis-core/workload` 既有出口），使其成为仓库内唯一的 worker 生命周期信道，具备承载 trajectory 工作负载所需的全部通用能力：worker→host 反向请求/应答消息对（通用 host-call，payload 对 core 完全不透明）、流式进度触发的提前 resolve（result/completion 双承诺票据）、可选 reject-on-cancel 语义（默认 resolve-partial 保持不变）、以及 ready 硬超时参数（上收 `awaitComputeHostReady` 与 `TrajectoryRuntime` 各自的 30s 竞速实现）；worker 侧新增第二种调度模式 `"interleaved"`，允许一个长流式任务运行期间并发服务短任务并取消特定请求。本子规格只交付 core 通用能力与 core 自身测试；不触碰 stage/vsc-ext 任何调用点——现有 compute 栈的默认行为（FIFO 调度、resolve-partial cancel、无 ready 超时）逐位保持，stage 现有测试在 02 落地前必须全绿。

## Design

### 实体与新符号

**`core/src/workload/protocol.ts` —— 信封扩展（generalize）**

- `WorkloadResponse<TResult, TProgress, THostCall = unknown>` 增加 worker→main 变体
  `{ type: "host-call"; callId: number; call: THostCall }`。`callId` 由 worker 侧自增分配，与 host 侧 job id 空间无关（各自路由各自的 pending map，无碰撞）。
- `WorkloadRequest<TJob, THostReply = unknown>` 增加 main→worker 变体
  `{ type: "host-reply"; callId: number; ok: boolean; result?: THostReply; error?: string }`。
- `isWorkloadResponse` 接受 `"host-call"` 标签；仍只做标签窄化，payload 校验归领域代码。
- 新增类型参数全部带 `unknown` 默认值——现有的 `WorkloadRequest<TJob>` / `WorkloadResponse<TResult, TProgress>` 实例化零改动编译通过。

core 只搬运不透明 payload，**绝不解释** `call` 的语义——字节范围（request-bytes）的类型化（`THostCall = { byteOffset; byteLen }` 之类）由 02 在 stage 完成。这守住 MolRS invariant：core 不为 host 开任何"重实现格式扫描器"的口子，host-call 在 core 层只是一个请求/应答信封。

**`core/src/workload/host.ts` —— `WorkloadHost` 扩展（generalize）**

- `WorkloadHostOptions<THostCall = unknown, THostReply = unknown>` 新增两个可选字段：
  - `readyTimeoutMs?: number` —— 设定后，worker 未在期限内发 `ready` 则 `whenReady()` 以 `[name] worker failed to start within <N>ms` 拒绝并走既有 `failAll` 路径；**缺省 undefined = 无定时器**，compute 栈行为不变。这是 02 吸收 `stage/src/compute/runtime.ts:54`（awaitComputeHostReady 的 30s 竞速）与 `TrajectoryRuntime` 构造器 30s 定时器的挂点；boot 心跳 UI（onBeat）不属于 wire/生命周期，留在 stage。
  - `onHostCall?: (call: THostCall) => Promise<{ result: THostReply; transfer?: Transferable[] }>` —— host-call 的应答者。收到 `host-call` 时调用，成功以 `{ type: "host-reply", callId, ok: true, result }`（附 transfer 清单，字节场景零拷贝传回）应答；handler 抛错或未配置则 `ok: false, error`（`[name]` 前缀），使 worker 侧承诺拒绝而非悬挂。host-reply 只在响应 worker 消息时发出（worker 必然已活），不受 Chrome pre-init 消息丢弃坑影响；`run` 的 `await this.ready` 门控保持原样。
- 新增 `submit(job, options): WorkloadJobTicket<TResult>`，接口
  `WorkloadJobTicket<TResult> = { id: number; result: Promise<TResult>; completion: Promise<TResult> }`。`run()` 保持签名与语义不变，收敛为 `submit(...).result` 的糖。票据暴露 `id` 正是 02 latest-wins 取消（`loadFrameTracked` 返回 `{requestId, promise}`）需要的形状；两个承诺内部各自挂 no-op catch，防止调用方只消费其一时产生 unhandled rejection（沿用 `ready` 承诺的既有手法）。
- `WorkloadRunOptions` 新增：
  - `earlyResolve?: (progress: TProgress) => TResult | undefined` —— 每条 `progress` 消息上调用；首次返回非 undefined 值即 resolve `ticket.result`，pending 条目保留继续路由 progress/终态。`completion` 始终在终态消息（`done` resolve / `error` reject）落定。未设 `earlyResolve` 时 `result` 与 `completion` 同步落定，即今日 `run` 语义。纯 host 侧 pending-map 扩展，wire 零改动。这是 02 重建 `open()`（`framesIndexedSoFar >= 1` 提前 resolve、`index-ready` 走 completion / `whenIndexComplete`）的挂点。
  - `cancelMode?: "resolve-partial" | "reject"` —— **缺省 `"resolve-partial"`**：现行为，cancel 只发一次、承诺留待 worker 自己的 done/error 落定。`"reject"`：cancel 发出的同时（无论来自 `shouldCancel` 轮询还是显式 `host.cancel(id)`）立即以 `WorkloadCancelledError` 拒绝 `result` 与 `completion` 并清出 pending map，迟到的 done/error 按既有未知-id 规则丢弃；cancel 消息仍然发给 worker 让它停止浪费算力。模式随 job 存入 `Pending`，`host.cancel(id)` 按存储的模式行事。这是 02 的 `loadFrameLatest` 语义（立即 reject `CancellationError`）的直接对应。
- 新增导出 `class WorkloadCancelledError extends Error { readonly jobId: number }`，`name = "WorkloadCancelledError"`，message 带 `[name]` 前缀——命名与构造随 stage `CancellationError` 先例。

**`core/src/workload/worker_side.ts` —— 调度与反向调用（generalize，实质工作量）**

- `WorkloadHandlerOptions` 新增 `scheduling?: "fifo" | "interleaved"`，**缺省 `"fifo"`**（现行为逐位保留：promise 链、一次一个、cancel 对排队任务先于启动生效）。`"interleaved"` 模式下每个 `run` 请求立即启动，任务在自身 await 边界（如 `ctx.callHost` 往返）协作式交错——单 realm 单 WASM 堆的前提不变，这不是并行而是事件循环交错，正是 trajectory「长索引任务流式进行的同时服务 load-frame」所需。两种模式内部以各一个私有调度类实现（`FifoScheduler` / `InterleavedScheduler`，同一个极小 `enqueue(id, job)` 座席），`installWorkloadHandler` 本体保持薄分发；调度类不出 barrel——公共面只有字符串选项。
- cancel 语义两模式统一：flag 记入 `cancelled` 集合直至该 job 落定；fifo 排队任务首轮询即见 flag，interleaved 任务启动即查 flag（领域 `run` 实现开头应查一次 `ctx.isCancelled()`）。
- `WorkloadWorkerContext` 新增 `callHost: (call: unknown, transfer?: Transferable[]) => Promise<unknown>` —— 发 `{ type: "host-call", callId, call }`，在 worker 侧 pendingCalls map 登记，收到对应 `host-reply` 后 resolve（`ok: false` 则以 `[workload] host call <callId>: <error>` 拒绝）。未知 `callId` 的 host-reply 静默忽略。心跳机制不变。
- `scope.onmessage` 分发增加 `host-reply` 分支；`WorkloadWorkerScope` 形状不变，单测继续以纯对象驱动。

**`core/src/workload/index.ts`** —— 追加导出 `WorkloadJobTicket`、`WorkloadCancelledError` 与更新后的类型。`./workload` 子路径出口为公共 API，本次全部为增量（additive），无破坏性变更。

### 生命周期与所有权

host-call 的 pendingCalls 归 worker realm 所有，随 worker 终止消亡；host 侧 `dispose()`/`failAll` 语义不变（terminate 即断，无需清理对侧）。票据的两个承诺由 `Pending` 条目统一驱动，settle-once：early-resolve 后到达的终态只落 `completion`；reject-cancel 后到达的终态被丢弃。core 不持有任何 molrs 对象，molrs-handles 规则不受影响。

### 02 的消费点（本规格不实现，仅立契约）

- request-bytes 类型化：stage 以 `THostCall = RequestBytes`、`THostReply = ArrayBuffer` 实例化 `WorkloadHost`，`onHostCall` 里调 `TrajectorySource.readRange`（seam 形状不变）并走 `transfer` 零拷贝。
- 调度选择：trajectory worker 模块以 `scheduling: "interleaved"` 安装；compute worker 不传（fifo 缺省）。
- cancel 语义：`loadFrameLatest` 以 `cancelMode: "reject"` 提交并持 `ticket.id` 做 latest-wins 取消；index pass 用缺省 resolve-partial 或 reject 由 02 决定。
- ready 超时：两处 30s 常量收敛为 `readyTimeoutMs: 30_000`，`awaitComputeHostReady` 的竞速与 `TrajectoryRuntime` 构造器定时器在 02 删除。

### Reuse decision

- generalize `WorkloadHost`（`core/src/workload/host.ts`）—— 补 librarian 缺口清单：onHostCall 反向应答、earlyResolve/双承诺票据、cancelMode 选项、readyTimeoutMs；ready 门控/pending map/cancel 轮询/transfer 原样保留。
- generalize `WorkloadRequest`/`WorkloadResponse` 信封（`core/src/workload/protocol.ts`）—— 增 host-call/host-reply 请求应答对。
- generalize `installWorkloadHandler`（`core/src/workload/worker_side.ts`）—— 结构性缺口即第二调度模式 + `callHost`，本规格的实质工作量。
- generalize `awaitComputeHostReady` —— 超时职责上收为 `WorkloadHost.readyTimeoutMs`；stage 侧该函数的删除/收编属 02，本规格只交付挂点，不动 stage 文件。
- reuse `frame_codec` `rehydrateFrame` + `frameMessageTransferList` —— 原样保留于 stage，02 消费；本规格不触碰。
- reuse `io/index.ts:572` `await Promise.resolve(spawnTrajectoryWorker(format))` 调用形状 —— 已容忍 async，03 消费；本规格不触碰。
- pattern `compute/spawn.ts` 字面 `new Worker(new URL(...))`、stage package.json 子路径出口先例 —— 归 03（spawn seam），本规格不触碰。
- generalize/converge `spawnWebviewWorkerFromHref` vs `LoadingWasm` —— 归 04（blob bootstrap 实机验证），本规格不触碰。

本规格不新增任何与上述候选重复职责的符号；新符号命名（`Workload*` 前缀、`[name]` 错误前缀、`WorkloadCancelledError` 类）随 Closest pattern。

## Files to create or modify

- `core/src/workload/protocol.ts`
- `core/src/workload/host.ts`
- `core/src/workload/worker_side.ts`
- `core/src/workload/index.ts`
- `core/tests/workload_protocol.test.ts` (new)
- `core/tests/workload_host.test.ts`
- `core/tests/workload_worker_side.test.ts`
- `regressions/worker-arch-unify-01-channel.ts` (new)

## Tasks

- [ ] Write failing unit tests for the host-call/host-reply envelope (core/tests/workload_protocol.test.ts (new) — isWorkloadResponse accepts "host-call", rejects junk; new variants type-check with defaulted params)
- [ ] Generalize `WorkloadRequest`/`WorkloadResponse` in core/src/workload/protocol.ts to carry the host-call/host-reply pair with defaulted type params
- [ ] Write failing unit tests for WorkloadHost extensions (core/tests/workload_host.test.ts — readyTimeoutMs rejection & unset-no-timer; submit ticket id/result/completion; cancelMode "reject" vs default resolve-partial; earlyResolve early settle + completion at done; onHostCall reply routing incl. transfer & missing-handler error)
- [ ] Generalize `WorkloadHost` in core/src/workload/host.ts (readyTimeoutMs, onHostCall dispatch, `submit`/`WorkloadJobTicket`, cancelMode, earlyResolve, `WorkloadCancelledError`; `run` delegates to `submit`)
- [ ] Write failing unit tests for worker-side scheduling and callHost (core/tests/workload_worker_side.test.ts — fifo default serial order preserved; interleaved settlement order; cancel of queued (fifo) and running (interleaved) specific ids; callHost resolve/reject; unknown-callId host-reply ignored)
- [ ] Generalize `installWorkloadHandler` in core/src/workload/worker_side.ts (`scheduling: "fifo" | "interleaved"` via private FifoScheduler/InterleavedScheduler, `ctx.callHost`, host-reply routing)
- [ ] Export new public symbols from core/src/workload/index.ts and document all new/changed public surface per jsdoc-tiered
- [ ] Add regression example regressions/worker-arch-unify-01-channel.ts (public API only; hard-coded goldens, no third-party runtime)
- [ ] Verify backward compatibility: stage package tests pass with zero stage source/test modifications (`npm test` scoped to stage), core existing tests pass unmodified
- [ ] Run full check + test suite

## Testing strategy

- 单元测试全部在 core 包内，镜像源文件布局（既有惯例 `core/src/workload/host.ts` → `core/tests/workload_host.test.ts`），每个测试针对单一函数/方法；core 自绿门 = `core/` 下 `rstest run`（`core/package.json` 的 `test`），不依赖全套件、不依赖 stage。
- `core/tests/workload_protocol.test.ts`（新）：`isWorkloadResponse` 快乐路径接受 `"host-call"`；边缘：null / 无 type / 未知 tag 拒绝。
- `core/tests/workload_host.test.ts`（扩展，注入 fake worker，既有先例）：快乐路径——`submit` 票据 id 自增、`result`/`completion` 同步落定（无 earlyResolve）；`earlyResolve` 首个匹配 progress 提前落定 `result`、`completion` 待 done；`onHostCall` 应答含 transfer 清单转发。边缘——`readyTimeoutMs` 到期 `whenReady` 拒绝、未设时无定时器；`cancelMode: "reject"` 立即以 `WorkloadCancelledError` 拒绝且迟到 done 被丢弃、缺省模式行为与现测试逐位一致；handler 未配置时 worker 收到 `ok: false` 应答。
- `core/tests/workload_worker_side.test.ts`（扩展，纯对象 `WorkloadWorkerScope` 驱动）：快乐路径——fifo 缺省两任务串行完成顺序不变；interleaved 下长任务流式中短任务先落定；`ctx.callHost` 往返 resolve。边缘——interleaved 下 cancel 特定运行中 id、fifo 下 cancel 排队 id；`ok: false` host-reply 使 callHost 拒绝；未知 callId 的 host-reply 静默忽略。
- 回归示例：`regressions/worker-arch-unify-01-channel.ts`（仓库根 `regressions/`，随 `worker-catalog-dispatch-01-seams.ts` 的 node 直跑先例）——只经 `@molcrafts/molvis-core/workload` 公共 API（core/dist），以内存 host↔scope 对接线：断言 interleaved 落定顺序硬编码金标 `["short-done", "long-done"]`、host-call 回声硬编码 `42`、reject-cancel 错误 `name === "WorkloadCancelledError"`；金标为本规格自定义字面量，无第三方 oracle，运行时零第三方、零 WASM。
- 项目门：`biome check . && npm run typecheck`、根 `npm test`。

## Out of scope

- stage/vsc-ext 的任何文件改动：`TrajectoryRuntime` 重建（02）、`awaitComputeHostReady` 删除与 compute 栈接 `readyTimeoutMs`（02）、spawn seam / `./worker-spawner` 出口 / rewrites 退役（03）、blob bootstrap 实机验证与收敛（04）。
- request-bytes 的类型化与 `TrajectorySource.readRange` 消费（02）；core 层 host-call payload 保持不透明。
- frame codec（`rehydrateFrame` / `frameMessageTransferList`）与 `.molidx` 缓存路径。
- notes / CLAUDE.md invariant 的任何更新（04 若推翻陷阱 2 时处理）。
- Jupyter 路径（主请求已明确排除）。
