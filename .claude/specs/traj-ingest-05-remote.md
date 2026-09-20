---
title: 远程轨迹 index-near-data
status: approved
created: 2026-08-18
revised: 2026-08-18
grilled: true
---

# 远程轨迹 index-near-data

## Summary

Remote 上第一次打开大轨迹时，**扩展宿主（数据旁边）调用与 webview 相同的 MolRS stream** 建帧表，把 `.molidx` 写在文件旁或 workspace cache；第二次打开只读这份表，不再经 SSH 扫 200GB。解码仍在本机 webview（04 `readRange` 拉一帧的 bytes → MolRS `parseRange`）。EH 不搬 Babylon / Trajectory LRU。**禁止**在 EH 用 JS 再写一套边界扫描器。

## Domain basis

无。

## Design

只改 `vsc-ext` + 文档。依赖 **00**（MolRS 是唯一 indexer）、**02**（`.molidx` 编解码）、**04**（range）。

EH 要跑 MolRS，就必须把 **同一份** `@molcrafts/molvis-core/molrs` wasm（Node 目标）编进 extension host，而不是复制算法。包装任务（rslib EH 能 `import` molrs stream、把 `readRange` 喂给 `feedIndexChunk`）属于本规格；若 Node 绑定尚未发布，本规格 **卡住 00**，不得用 `TrajectoryBoundaryIndexer` 顶上。

`RemoteMolrsIndexer`：注入 `readRange` + molrs stream 类。返回 MolRS 的 `FrameIndexEntry[]`。structure / 尚不可 stream 的格式返回 `null`。

`RemoteIndexStore`：放置先可写者胜——(1) 同目录 `<file>.molidx` (2) `storageUri` / `globalStorageUri` (3) `"none"`（EH 不写 laptop OPFS）。编解码只用 02。

`MolecularFileLoader` 在 stream 路径 `ensure` 后把 v2 bytes 挂到 `openUri.index`。DataSource **没有 kind**（见 06）；传输（SSH）不是 DataSource 子类，也不是 MolRS 概念。

Webview：收到 `index` 则写入本机 OPFS idx 桶，走 worker 快路径。

### Reuse decision

- `reuse` 00 MolRS stream / 02 codec / 04 range / `decideIngest` / core `safeKey`
- `pattern remote.md`
- `new RemoteIndexStore` — 放置策略是 host 的
- `new RemoteMolrsIndexer` — **薄封装**，只调 molrs，零格式逻辑
- **禁止** `TrajectoryBoundaryIndexer` 式 JS 重实现

## Files to create or modify

- `vsc-ext/src/extension/loading/remoteMolrsIndexer.ts` (new)
- `vsc-ext/src/extension/loading/remoteIndexStore.ts` (new)
- `vsc-ext/src/extension/loading/molecularFileLoader.ts`
- `vsc-ext/src/protocol/messages.ts`
- `vsc-ext/src/extension/panels/messaging.ts`
- `vsc-ext/src/webview/attachStageHost.ts`
- `vsc-ext/src/extension/activate.ts`
- `vsc-ext/tests/unit/loading/remoteMolrsIndexer.test.ts` (new)
- `vsc-ext/tests/unit/loading/remoteIndexStore.test.ts` (new)
- `vsc-ext/tests/unit/protocol/messages.test.ts`
- `vsc-ext/tsconfig.test.json`
- `docs/interfaces/vscode/remote.md`
- `docs/interfaces/vscode/troubleshooting.md`
- `regressions/traj-ingest-05-remote.ts` (new)

## Tasks

- [ ] Write failing unit tests for RemoteMolrsIndexer (fake molrs stream; asserts no local ITEM: TIMESTEP parser)
- [ ] Implement RemoteMolrsIndexer as a thin molrs feed wrapper in vsc-ext/src/extension/loading/remoteMolrsIndexer.ts
- [ ] Write failing unit tests for RemoteIndexStore
- [ ] Implement RemoteIndexStore in vsc-ext/src/extension/loading/remoteIndexStore.ts
- [ ] Write failing unit tests for the openUri index field
- [ ] Implement loader/host/webview wiring; include new modules in tsconfig.test.json
- [ ] Expand remote.md and troubleshooting.md for index-near-data
- [ ] Add regression example regressions/traj-ingest-05-remote.ts
- [ ] Run full check + test suite

## Testing strategy

- RemoteMolrsIndexer：fake molrs stream 记录 feed 调用；测试文件不得出现 `ITEM: TIMESTEP` 解析实现。structure / 无 stream 的格式 → null。
- Store：sibling 写失败则写入 cache root；两级失败返回 `"none"`；hit 不调 indexer。
- 回归：v2 codec round-trip；sibling 名 `traj.xyz.molidx`；`decideIngest("lammps-dump", 200GiB, { hostCanRange: true }) === { path: "stream" }`。

## Out of scope

- decode-near-data
- 新 DataSourceKind ssh/http
- Wasm*Stream / Babylon 进 EH
- 新 MolRS DCD/XTC/TRR reader
- 改 page / Trajectory.length / stage OpenRequest
- 第二套 index 格式
- EH 读 laptop OPFS
- 首次扫描进度 UI / stale GC
