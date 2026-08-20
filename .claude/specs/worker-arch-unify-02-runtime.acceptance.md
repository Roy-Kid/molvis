---
slug: worker-arch-unify-02-runtime
criteria:
  - id: ac-001
    summary: TrajectoryRuntime rebuilt on WorkloadHost, hand-rolled lifecycle deleted
    type: code
    pass_when: |
      stage/src/transport/trajectory_worker/runtime.ts constructs a WorkloadHost
      (name "trajectory-<format>", readyTimeoutMs 30_000) and contains no
      hand-rolled pending map, workerReady promise, constructor setTimeout, or
      serveBytes/dispatch switch; the public constructor (worker: WorkerLike,
      format: Format) is unchanged and the rewritten
      stage/tests/transport/trajectory_worker/runtime.test.ts passes.
    status: pending
  - id: ac-002
    summary: open() early-resolves on first indexed frame, completion feeds waiters
    type: code
    pass_when: |
      Unit tests prove open() resolves with the hard-coded early OpenResult
      { frameCount: 2, indexedLength: 2, length: null, indexComplete: false,
      totalBytes: 1024 } on the first progress with framesIndexedSoFar >= 1, and
      whenIndexComplete plus onIndexComplete later receive the indexComplete: true
      terminal result via the ticket completion.
    status: pending
  - id: ac-003
    summary: latest-wins rejects with stage CancellationError, channel error never escapes
    type: code
    pass_when: |
      Unit tests prove a superseded loadFrameLatest rejects with an error that is
      instanceof CancellationError (name "CancellationError"), cancelOpen rejects
      the in-flight open the same way, and no rejection surfaced by
      TrajectoryRuntime is a core WorkloadCancelledError.
    status: pending
  - id: ac-004
    summary: request-bytes is a typed host-call preserving readRange seam and packed copy
    type: code
    pass_when: |
      The runtime's onHostCall receives { byteOffset, byteLen }, calls
      TrajectorySource.readRange with an unchanged signature, and the pooled-view
      unit test proves the reply bytes equal the hard-coded sequence with the
      packed ArrayBuffer present in the transfer list (never the pooled backing
      buffer).
    status: pending
  - id: ac-005
    summary: Worker module runs on installWorkloadHandler with interleaved scheduling
    type: code
    pass_when: |
      stage/src/transport/trajectory_worker/worker.ts installs
      installWorkloadHandler({ scheduling: "interleaved", ... }) as its only
      message wiring; grep finds no "worker-heartbeat", no pendingFetches map, and
      no cancelledOpenId/cancelledFrameIds sets; byte fetches go through
      ctx.callHost and cancellation through ctx.isCancelled.
    status: pending
  - id: ac-006
    summary: Both 30s ready timeouts absorbed into readyTimeoutMs, beat UI kept
    type: code
    pass_when: |
      stage/src/compute/runtime.ts passes readyTimeoutMs: 30_000 to its
      WorkloadHost and awaitComputeHostReady contains no Promise.race/setTimeout;
      stage/tests/compute/runtime.test.ts proves the beat still fires at 2s
      cadence, a whenReady rejection propagates, and no rejection originates from
      awaitComputeHostReady itself under fake timers; both worker_client call
      sites are unmodified.
    status: pending
  - id: ac-007
    summary: Externally consumed public surface preserved; wire-type removal declared
    type: code
    pass_when: |
      TrajectoryRuntime, WorkerLike, CancellationError, OpenOptions, OpenResult,
      IndexProgressCallback, spawnTrajectoryWorker remain exported from
      ./trajectory-runtime and Format/SourceHandle/FrameMessage/
      frameMessageTransferList/rehydrateFrame from ./trajectory-protocol and the
      barrel with unchanged shapes (vsc-ext/page/io compile with zero edits); the
      spec/PR text explicitly lists the deleted ./trajectory-protocol wire types
      as a deliberate breaking change.
    status: pending
  - id: ac-008
    summary: runtime.ts stays at its exact path and name for the webview rewrite regex
    type: code
    pass_when: |
      git diff --name-status shows stage/src/transport/trajectory_worker/runtime.ts
      as modified (M), never renamed/deleted, and
      vsc-ext/rslib.webview.worker-rewrites.mts is untouched, so the
      NormalModuleReplacementPlugin regex still matches until 03.
    status: pending
  - id: ac-009
    summary: Changed public surface documented per jsdoc-tiered
    type: docs
    pass_when: |
      Every exported symbol added or semantically changed in
      stage/src/transport/trajectory_worker/{protocol,runtime,index}.ts and
      stage/src/compute/runtime.ts carries a jsdoc-tiered docstring covering the
      channel semantics (early resolve, reject-on-cancel translation, host-call
      byte supply, ready timeout ownership).
    status: pending
  - id: ac-010
    summary: Regression script reproduces hard-coded runtime goldens via public API
    type: runtime
    pass_when: |
      `node regressions/worker-arch-unify-02-runtime.ts` (after stage build, .wasm
      stub preamble, no WASM instantiation) exits 0, asserting the hard-coded
      literals: early OpenResult { frameCount: 2, indexedLength: 2, length: null,
      indexComplete: false, totalBytes: 1024 }, latest-wins rejection name
      "CancellationError", and host-call reply bytes [1, 2, 3, 4], importing only
      @molcrafts/molvis-stage/trajectory-runtime.
    status: pending
  - id: ac-011
    summary: No diffs outside stage/ and regressions/; stage suite green
    type: runtime
    pass_when: |
      git diff --name-only touches only stage/ and regressions/ paths (vsc-ext,
      page, core, stage/src/io untouched), and the stage package test suite exits
      0 on its own.
    status: pending
  - id: ac-012
    summary: Full project gates pass
    type: runtime
    pass_when: |
      `biome check . && npm run typecheck` and root `npm test` all exit 0 on the
      final tree.
    status: pending
---

# Acceptance criteria

ac-001–ac-006 锁重建本体的六个可观察行为（宿主替换、提前 resolve、取消翻译、host-call 字节 seam、worker 调度、超时上收），全部由 stage 包内单测独立判定。ac-007/ac-008 是公共面与 03 前置约束的硬门（vsc-ext 零改动编译、runtime.ts 原位原名）。ac-009 锁文档。ac-010 是回归示例（公共子路径 + 硬编码金标 + 零 WASM）。ac-011 锁改动半径与 stage 自绿。ac-012 收全项目门。
