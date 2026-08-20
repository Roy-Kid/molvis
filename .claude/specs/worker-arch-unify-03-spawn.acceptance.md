---
slug: worker-arch-unify-03-spawn
criteria:
  - id: ac-001
    summary: Single spawn module owns both literal new Worker expressions
    type: code
    pass_when: |
      stage/src/worker_spawner.ts contains exactly two literal
      `new Worker(new URL(...))` expressions with dist-relative URLs
      "./transport/trajectory_worker/worker.js" and "./compute/worker.js", and no
      other file under stage/src contains a literal `new Worker(new URL(`
      expression (grep over stage/src returns only worker_spawner.ts).
    status: pending
  - id: ac-002
    summary: ./worker-spawner is a public subpath export with async signatures
    type: code
    pass_when: |
      stage/package.json exports "./worker-spawner" with types+import+default
      entries mapping dist/worker_spawner.*, and the module exports
      spawnTrajectoryWorker(format): Promise<TrajectoryRuntime>,
      spawnComputeWorker(): Promise<Worker>, and DeferredWorker.
    status: pending
  - id: ac-003
    summary: DeferredWorker bridges async spawn into the sync createWorker factory
    type: code
    pass_when: |
      stage/tests/worker_spawner.test.ts proves buffering/ordered flush
      (["a","b","c"]), onmessage/onerror forwarding, terminate-before-resolve,
      and spawn-rejection→synthesized error event; stage/src/compute/runtime.ts
      passes createWorker: () => new DeferredWorker(spawnComputeWorker()) with
      getComputeRuntime, createWorkloadSingleton, and both worker_client call
      sites unmodified.
    status: pending
  - id: ac-004
    summary: Old spawn locations retired; breaking removals declared
    type: code
    pass_when: |
      spawnTrajectoryWorker is gone from stage/src/transport/trajectory_worker/
      runtime.ts and index.ts, stage/src/compute/spawn.ts is deleted, compute
      barrel no longer exports spawnComputeWorker, and the spec/PR text lists both
      removals as deliberate breaking changes on ./trajectory-runtime and the
      compute barrel.
    status: pending
  - id: ac-005
    summary: Stage consumers use the self-referenced subpath; Promise.resolve patch gone
    type: code
    pass_when: |
      stage/src/io/index.ts and stage/src/compute/runtime.ts import from
      "@molcrafts/molvis-stage/worker-spawner"; io's call site reads
      `await spawnTrajectoryWorker(format)` with no Promise.resolve wrapper and no
      remaining relative import of the retired spawn modules anywhere in stage/src.
    status: pending
  - id: ac-006
    summary: vsc-ext alias module replaces both wrappers with seam-identical shapes
    type: code
    pass_when: |
      vsc-ext/src/webview/worker_spawner.ts exports both functions with signatures
      identical to the stage subpath (verified by vsc-ext/tests/unit/webview/
      worker_spawner.test.ts via module fakes), delegating trajectory→
      spawnWebviewWorkerLoadingWasm and compute→spawnWebviewWorkerFromHref;
      spawnTrajectoryWorker.ts and spawnComputeWorker.ts are deleted.
    status: pending
  - id: ac-007
    summary: worker-rewrites retired, replaced by one exact-match alias line
    type: code
    pass_when: |
      vsc-ext/rslib.webview.worker-rewrites.mts no longer exists; both
      rslib.webview.config.mts and rslib.webview.page.config.mts contain the
      "@molcrafts/molvis-stage/worker-spawner$" resolve.alias entry pointing at
      src/webview/worker_spawner.ts and contain no NormalModuleReplacementPlugin
      or worker-rewrites reference.
    status: pending
  - id: ac-008
    summary: Existing regression guards pass with zero edits
    type: runtime
    pass_when: |
      `node regressions/traj-ingest-03-hud.ts` and
      `node regressions/worker-catalog-dispatch-01-seams.ts` both exit 0 while
      git diff shows neither file modified.
    status: pending
  - id: ac-009
    summary: New public surface documented per jsdoc-tiered
    type: docs
    pass_when: |
      spawnTrajectoryWorker, spawnComputeWorker, and DeferredWorker in
      stage/src/worker_spawner.ts (and the vsc-ext alias module header) carry
      jsdoc-tiered docstrings covering the literal-URL bundler constraint, the
      async seam contract, and the alias replacement mechanism.
    status: pending
  - id: ac-010
    summary: Regression script locks the seam shape via public API
    type: runtime
    pass_when: |
      `node regressions/worker-arch-unify-03-spawn.ts` (after stage build) exits 0,
      asserting the hard-coded literals: ./worker-spawner exports exactly
      ["DeferredWorker", "spawnComputeWorker", "spawnTrajectoryWorker"] with both
      spawns async; ./trajectory-runtime no longer exports spawnTrajectoryWorker;
      both webview rslib configs contain "worker-spawner$" and no
      "worker-rewrites".
    status: pending
  - id: ac-011
    summary: Full project gates pass; both packages green on their own
    type: runtime
    pass_when: |
      stage and vsc-ext package test suites each exit 0 in isolation, and
      `biome check . && npm run typecheck` plus root `npm test` exit 0 on the
      final tree.
    status: pending
---

# Acceptance criteria

ac-001/ac-002 锁 seam 本体（字面收拢的唯一性 + 公共子路径形状）。ac-003 锁 async→sync 桥接且 compute 消费方零涟漪。ac-004/ac-005 锁旧位置退役与 declared breaking、自引用接线。ac-006/ac-007 锁 vsc-ext 半边（alias 模块 + rewrites 死亡）。ac-008 是两个既有守卫的零改动硬门。ac-009 锁文档。ac-010 是回归示例（锁 seam 不回潜）。ac-011 收两包自绿与全项目门。
