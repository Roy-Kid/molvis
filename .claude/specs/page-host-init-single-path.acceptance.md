---
slug: page-host-init-single-path
criteria:
  - id: ac-001
    summary: MolvisWrapper no longer claims host init/applySettings
    type: code
    pass_when: |
      page/src/MolvisWrapper.tsx contains no handleHostMessage, no
      window.addEventListener("message", …) for it and no matching
      removeEventListener; any import it alone kept alive is gone (biome reports
      no unused symbol in that file).
    status: pending
  - id: ac-002
    summary: The deletion is proven to bite
    type: runtime
    pass_when: |
      page/tests/MolvisWrapper.host-messages.test.tsx dispatches a window
      `applySettings` message at a mounted MolvisWrapper and asserts the engine
      settings are unchanged. The test was confirmed red against the pre-deletion
      file and green after.
    status: pending
  - id: ac-003
    summary: No origin guard is added on the other side
    type: code
    pass_when: |
      vsc-ext/src/webview/attachStageHost.ts is unmodified by this spec — the fix
      is one deletion, not a second rule.
    status: pending
  - id: ac-004
    summary: Page suite green
    type: runtime
    pass_when: |
      `npm run test:page` passes with zero failures and all pre-commit hooks pass.
    status: pending
---

# Acceptance criteria

- **ac-002** 是本 spec 唯一的闸，且方向正确：删除前红、删除后绿。
- **ac-003** 记录设计决定——两条规则合并成一条，而不是把缺失的守卫补到另一条上。
