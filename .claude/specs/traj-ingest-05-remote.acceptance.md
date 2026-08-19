---
spec: traj-ingest-05-remote
created: 2026-08-18
criteria:
  - id: ac-001
    summary: EH indexer is a thin molrs wrapper
    type: runtime
    pass_when: |
      remoteMolrsIndexer.test.ts is green; the implementation calls a
      molrs stream (fake in the test) and contains no ITEM: TIMESTEP /
      XYZ-N / $$$$ scanning of its own.
    status: pending
  - id: ac-002
    summary: No host-local frame-boundary scanner
    type: code
    pass_when: |
      vsc-ext/src has no TrajectoryBoundaryIndexer and no format-specific
      index loops; RemoteMolrsIndexer only constructs molrs stream classes
      from @molcrafts/molvis-core/molrs (Node).
    status: pending
  - id: ac-003
    summary: Store first-writable-wins placement
    type: runtime
    pass_when: |
      RemoteIndexStore tests: sibling write failure records
      safeKey(fingerprint).molidx under the cache root; dual failure
      returns "none" without throwing.
    status: pending
  - id: ac-004
    summary: Store reads v2 codec; mismatch is miss
    type: code
    pass_when: |
      load/save/ensure call encodeMolidx/decodeMolidx from the 02
      host-safe export; decode null or format/size mismatch is a miss.
    status: pending
  - id: ac-005
    summary: Loader attaches v2 index on stream openUri
    type: code
    pass_when: |
      MolecularFileLoader still uses decideIngest(..., { hostCanRange: true });
      stream path encodeMolidx's onto openUri.index; no ssh/http
      DataSourceKind; activate injects storageUri then globalStorageUri.
    status: pending
  - id: ac-006
    summary: Webview deposits index into existing OPFS idx bucket
    type: code
    pass_when: |
      attachStageHost writes index bytes to /molvis/v1/idx/<safeKey>.molidx
      before loadFileStream; no new postMessage type.
    status: pending
  - id: ac-007
    summary: Extension host stays wasm- and Babylon-free
    type: code
    pass_when: |
      vsc-ext/src/extension has no new import of molrs, babylon, or
      stage/io barrels.
    status: pending
  - id: ac-008
    summary: Docs describe sidecar tiers
    type: docs
    pass_when: |
      remote.md states sibling / workspace-or-globalStorage / webview
      OPFS and that a sidecar hit skips the SSH full-file scan.
    status: pending
  - id: ac-009
    summary: Regression locks codec, sibling name, and 200GB stream
    type: runtime
    pass_when: |
      node regressions/traj-ingest-05-remote.ts exits 0; embeds xyz
      totalBytes 52 FramePos 0/26 and 26/26; sibling name
      traj.xyz.molidx; decideIngest 200GiB dump hostCanRange true
      equals {path:stream}.
    status: pending
out_of_scope:
  - decode-near-data
  - new DataSourceKind ssh/http
  - MolRS DCD/XTC/TRR readers or Wasm*Stream in the EH
  - page/ and Trajectory.length
  - second on-disk index format
  - EH reading laptop OPFS
---

# Acceptance — traj-ingest-05-remote

Done = 远程大文本轨迹的帧表在数据旁边写成 02 的 v2 `.molidx`；第二次打开只读这份表；EH 没有 wasm / Babylon / 坐标解码。
