---
title: 轨迹 HUD 消费三分量
status: in-progress
created: 2026-08-18
grilled: true
---

# 轨迹 HUD 消费三分量

## Summary

Page 画布底栏的时间轴 / filmstrip 与 Compute 范围控件改为消费 `traj-ingest-01-index` 的三分量。终长未知时条带只按已索引帧数寻址，扫描中状态走既有 `ViewerStatusOverlay`；「跳到最后」只落到最后一帧已索引帧。`indexComplete` 之前，分析里空 end（整条轨迹）不可用，必须填显式结束帧。`loadFileSmart` / Esc / `decideIngest` 保持不动。不新增 status bar。

## Domain basis

无。

## Design

只读 stage 公有面。page 在 `trajectory-change`（及挂载时）读取 `length` / `indexedLength` / `indexComplete`。

新增不可变值对象 `TrajectoryExtent`（`page/src/lib/trajectory-extent.ts`）：`addressableLength`（`length ?? indexedLength`）、`lastAddressableIndex`、`allowsImplicitWholeRange`、`implicitEndIndex()`、`filmstripVisible`、`frameReadout`（扫描中 `"3/12…"`）、`lastControlLabel`（扫描中 `"Last indexed frame"`）。

`useMolvisUiState` 用 `trajectoryExtent` 取代 `trajectoryLength: number`。`TrajectoryTimeline.totalFrames` 语义升为可寻址帧数，加 `indexComplete?`。`parseScopeRange` 空 end 且未 complete → `{ ok: false, reason: "needs-explicit-end" }`，不得回填 `indexedLength - 1`。MSD/RDF Run 在 blocked 时禁用。扫描文案含 `frame(s) ready`；未 complete 不得发 success `"Indexed"`。

### Reuse decision

- `reuse loadFileSmart` / `ViewerStatusOverlay`
- `generalize useMolvisUiState.trajectoryLength` / `TrajectoryTimeline.totalFrames`
- `pattern status-message.progress`
- `new TrajectoryExtent` — HUD 与分析共用的纯查询，无 React

## Files to create or modify

- `page/src/lib/trajectory-extent.ts` (new)
- `page/tests/lib/trajectory-extent.test.ts` (new)
- `page/src/hooks/useMolvisUiState.ts`
- `page/tests/hooks/useMolvisUiState.test.ts` (new)
- `page/src/ui/layout/analysis/useAnalysisHooks.ts`
- `page/tests/ui/layout/analysis/useAnalysisHooks.test.ts` (new)
- `page/src/App.tsx`
- `page/src/components/viewer/TrajectoryTimeline.tsx`
- `page/tests/components/viewer/TrajectoryTimeline.test.tsx` (new)
- `page/src/components/viewer/TrajectoryPlaybackControls.tsx`
- `page/src/ui/layout/analysis/AnalysisScope.tsx`
- `page/tests/ui/layout/analysis/AnalysisScope.test.ts` (new)
- `page/src/ui/layout/LeftSidebar.tsx`
- `page/src/ui/layout/analysis/MsdPanel.tsx`
- `page/src/ui/layout/analysis/RdfPanel.tsx`
- `page/src/components/format-picker-dialog.tsx`
- `regressions/traj-ingest-03-hud.ts` (new)

## Tasks

- [ ] Write failing unit tests for TrajectoryExtent (page/tests/lib/trajectory-extent.test.ts)
- [ ] Implement TrajectoryExtent in page/src/lib/trajectory-extent.ts
- [ ] Write failing unit tests for useMolvisUiState and useTrajectoryLength
- [ ] Generalize useMolvisUiState.trajectoryLength and useTrajectoryLength to TrajectoryExtent; wire App.tsx
- [ ] Write failing unit tests for TrajectoryTimeline and AnalysisScope
- [ ] Generalize TrajectoryTimeline.totalFrames and last-frame label; generalize AnalysisScope / MSD / RDF gates; add loadFileSmart scanning copy
- [ ] Add docstring per jsdoc-tiered with units (frames; progress 0–100)
- [ ] Add regression example regressions/traj-ingest-03-hud.ts
- [ ] Run full check + test suite

## Testing strategy

- TrajectoryExtent：完成态 `"3/40"` / last 39；扫描态 `"3/12…"` / last 11 / implicitEnd null。
- Timeline：`indexComplete=false` 时 seek 不超过 11。
- AnalysisScope：空 end + 扫描 → needs-explicit-end；显式 end=5 仍 ok。
- 回归：硬编码 12/11/`3/12…`；源码锁 ViewerStatusOverlay + decideIngest + frame(s) ready。

## Out of scope

- 01 本身、molidx、worker
- 重做 loadFileSmart 路由
- 新 status bar
- 整条轨迹文件导出
- vsc-ext / Python HUD
