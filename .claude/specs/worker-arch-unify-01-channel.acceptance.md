---
slug: worker-arch-unify-01-channel
criteria:
  - id: ac-001
    summary: Protocol envelope carries host-call/host-reply pair, backward compatible
    type: code
    pass_when: |
      core/src/workload/protocol.ts defines the worker→main "host-call" variant and
      main→worker "host-reply" variant with defaulted new type params;
      isWorkloadResponse accepts "host-call"; core/tests/workload_protocol.test.ts
      passes and pre-existing generic instantiations compile unchanged
      (npm run typecheck green with no stage/vsc-ext edits).
    status: pending
  - id: ac-002
    summary: installWorkloadHandler gains "interleaved" scheduling, "fifo" stays default
    type: code
    pass_when: |
      core/tests/workload_worker_side.test.ts proves: with scheduling omitted, two jobs
      settle strictly serially (existing FIFO tests pass unmodified); with
      "interleaved", a short job's done arrives while a long job is still streaming
      progress; cancel of a queued id (fifo) and of a running id (interleaved) both
      take effect via ctx.isCancelled().
    status: pending
  - id: ac-003
    summary: ctx.callHost round-trips to host onHostCall, rejects when unhandled
    type: code
    pass_when: |
      Unit tests show ctx.callHost(call) resolves with the value returned by the
      host's onHostCall (transfer list forwarded on the reply postMessage), rejects
      with a "[<name>]"-prefixed error when the host has no onHostCall, and an
      unknown-callId host-reply is silently ignored.
    status: pending
  - id: ac-004
    summary: WorkloadHost.submit returns {id, result, completion}; run unchanged
    type: code
    pass_when: |
      core/tests/workload_host.test.ts proves submit() returns a WorkloadJobTicket
      exposing the correlation id and both promises; run() delegates to submit and
      all pre-existing WorkloadHost tests pass unmodified.
    status: pending
  - id: ac-005
    summary: cancelMode "reject" rejects with WorkloadCancelledError; default unchanged
    type: code
    pass_when: |
      Unit tests prove: with cancelMode "reject", host.cancel(id) (and the
      shouldCancel poll) immediately rejects result and completion with
      WorkloadCancelledError (name === "WorkloadCancelledError", jobId set) and a
      late done for that id is dropped; with cancelMode omitted the promise still
      settles through the worker's own done (resolve-partial).
    status: pending
  - id: ac-006
    summary: earlyResolve settles result on matching progress, completion at done
    type: code
    pass_when: |
      Unit test proves: with earlyResolve returning a value on the first matching
      progress, ticket.result resolves before the worker posts done and
      ticket.completion resolves later with the terminal result; without
      earlyResolve, result and completion settle together.
    status: pending
  - id: ac-007
    summary: readyTimeoutMs rejects whenReady on boot timeout; unset means no timer
    type: code
    pass_when: |
      Unit tests prove: with readyTimeoutMs set and no ready message, whenReady()
      rejects with a "[<name>]"-prefixed timeout error and the host goes dead;
      with the option unset, no timeout ever fires (fake timers advance past 30s
      without rejection).
    status: pending
  - id: ac-008
    summary: New public workload surface documented per jsdoc-tiered
    type: docs
    pass_when: |
      Every new or semantically changed exported symbol in core/src/workload/
      (submit, WorkloadJobTicket, WorkloadCancelledError, onHostCall,
      readyTimeoutMs, cancelMode, earlyResolve, scheduling, callHost, new protocol
      variants) carries a jsdoc-tiered docstring stating semantics and defaults.
    status: pending
  - id: ac-009
    summary: Regression script reproduces hard-coded channel goldens via public API
    type: runtime
    pass_when: |
      `node regressions/worker-arch-unify-01-channel.ts` (after core build) exits 0,
      asserting the hard-coded literals: interleaved settlement order
      ["short-done", "long-done"], host-call echo result 42, and cancel rejection
      name "WorkloadCancelledError", importing only @molcrafts/molvis-core/workload
      dist — no WASM, no third-party runtime.
    status: pending
  - id: ac-010
    summary: Stage package stays green with zero stage modifications
    type: runtime
    pass_when: |
      git diff shows no changes under stage/ or vsc-ext/, and the stage package test
      suite passes as-is — proving FIFO default, resolve-partial default, and
      no-ready-timeout default preserved for the existing compute stack.
    status: pending
  - id: ac-011
    summary: Full project gates pass
    type: runtime
    pass_when: |
      `biome check . && npm run typecheck` and root `npm test` all exit 0 on the
      final tree.
    status: pending
---

# Acceptance criteria

ac-001–ac-007 锁 core 信道扩展的七个可观察行为（信封、调度、反向调用、票据、cancel 语义、提前 resolve、ready 超时），全部由 core 包内单测独立判定。ac-008 锁新公共面的 jsdoc-tiered 文档。ac-009 是本规格的回归示例（公共 API + 硬编码金标）。ac-010 是向后兼容硬门：stage 零改动全绿，证明三个默认值逐位保留。ac-011 收全项目门。
