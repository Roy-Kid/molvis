---
slug: worker-arch-unify-04-bootstrap
criteria:
  - id: ac-001
    summary: Pre-convergence hardware verification executed with recorded evidence
    type: runtime
    evaluator_hint: "manual: extension development host"
    pass_when: |
      The PR text and the notes.md update contain a dated verification record
      naming, for each worker (trajectory via spawnWebviewWorkerLoadingWasm,
      compute via spawnWebviewWorkerFromHref), the observed wasm load outcome with
      console/network/CSP evidence from a real VS Code extension development host,
      and exactly one selected branch (a / b / c).
    status: pending
  - id: ac-002
    summary: spawnWebviewWorker.ts converged to one exported spawn path
    type: code
    pass_when: |
      vsc-ext/src/webview/spawnWebviewWorker.ts exports exactly one spawn entry
      named spawnWebviewWorker returning Promise<Worker>, the losing branch's
      machinery is absent from the file (branch a: no webviewWorkerBootstrap /
      spawnWebviewWorkerFromHref; branch b/c: no WASM_LOADER_HASH /
      wasmHrefFromWorkerScript / webviewWorkerWithPostedWasm / waitForWasmWant /
      spawnWebviewWorkerLoadingWasm), and the module-header trap commentary
      matches the verified reality.
    status: pending
  - id: ac-003
    summary: worker_spawner delegates both spawns to the converged path
    type: code
    pass_when: |
      vsc-ext/tests/unit/webview/worker_spawner.test.ts proves via module fakes
      that spawnTrajectoryWorker and spawnComputeWorker both call
      spawnWebviewWorker, differing only in (href, name) arguments
      ("trajectory-<format>" / "molvis-compute"), with seam signatures unchanged.
    status: pending
  - id: ac-004
    summary: WEBVIEW_ASSET_REV bumped for the bootstrap change
    type: code
    pass_when: |
      vsc-ext/src/extension/panels/html.ts no longer contains the literal
      "dcd-preview-8" and WEBVIEW_ASSET_REV carries a new value; the CSP still
      grants `worker-src ${webview.cspSource} blob:`, with any further CSP edit
      justified in the PR text by the surviving path's needs.
    status: pending
  - id: ac-005
    summary: Notes and CLAUDE.md invariant consistent with the surviving path
    type: docs
    pass_when: |
      Exactly one consistent documentation state holds: branch a — the CLAUDE.md
      "posted, never fetched" invariant is unchanged and the notes.md
      webview-worker-wasm entry gains a dated addendum recording that compute had
      shipped on the unverified FromHref path; branch b/c — the notes entry is
      rewritten with the verification record and the CLAUDE.md invariant text is
      updated in the same change, explicitly marked as a deliberate decision.
    status: pending
  - id: ac-006
    summary: Unit tests rewritten to the converged surface only
    type: code
    pass_when: |
      vsc-ext/tests/unit/webview/spawnWebviewWorker.test.ts passes while
      referencing only surviving exports (no test imports a deleted helper), and
      the vsc-ext package test suite exits 0 on its own.
    status: pending
  - id: ac-007
    summary: Post-convergence hardware verification passes for both workers
    type: runtime
    evaluator_hint: "manual: extension development host"
    pass_when: |
      In a real extension development host running the converged build, opening a
      trajectory file indexes and renders frames, one compute (optimize/analysis)
      job completes, and the webview DevTools console shows no wasm fetch/CSP
      failure; the outcome is recorded in the PR text.
    status: pending
  - id: ac-008
    summary: Regression script locks the converged bootstrap state
    type: runtime
    pass_when: |
      `node regressions/worker-arch-unify-04-bootstrap.ts` exits 0, asserting the
      hard-coded literals: exactly one exported spawnWebviewWorker in
      spawnWebviewWorker.ts with the branch-designated loser symbol absent, two
      spawnWebviewWorker( delegations in worker_spawner.ts, html.ts free of
      "dcd-preview-8" and still containing the worker-src blob: CSP line, and a
      dated webview-worker-wasm notes entry.
    status: pending
  - id: ac-009
    summary: Full project gates pass with worker entries untouched
    type: runtime
    pass_when: |
      git diff shows vsc-ext/rslib.webview.worker.config.mts and all stage/core
      paths untouched, and `biome check . && npm run typecheck` plus root
      `npm test` exit 0 on the final tree.
    status: pending
---

# Acceptance criteria

ac-001 与 ac-007 是两次实机验证的 runtime 硬门（手动/agent 驱动，证据实录，先裁分支、后验终态）。ac-002–ac-004 锁收敛终态的三个可观察代码事实（单一导出、双委托、缓存失效 bump）。ac-005 是"不得静默"的文档一致性门——三分支各自的合法终态被穷举，任何其他组合即失败。ac-006 锁测试面随存活面重写。ac-008 是回归示例（文本锁，防败者机器回潜）。ac-009 收改动半径与全项目门。
