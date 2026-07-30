---
spec: stage-commit-scene
created: 2026-07-30
criteria:
  - id: ac-001
    summary: "commitScene dumps SceneIndex to system.frame and installs MemoryDataSource when needed"
    type: runtime
    pass_when: "After seeding edit-pool atoms on an empty app, commitScene yields frameHasStructure(system.frame) and exactly one DataSourceModifier"
    status: verified
    last_checked: 2026-07-30
  - id: ac-002
    summary: "Edit commands do not auto-commit to system.frame"
    type: runtime
    pass_when: "After an edit-pool mutation without commitScene, system.frame still lacks structure while hasUnsavedChanges is true"
    status: verified
    last_checked: 2026-07-30
  - id: ac-003
    summary: "discardScene restores working tree from committed HEAD"
    type: runtime
    pass_when: "Commit N atoms, add dirty edits, discardScene restores N atoms and clears dirty"
    status: verified
    last_checked: 2026-07-30
  - id: ac-004
    summary: "commitScene does not invoke applyPipeline full rebuild as part of commit"
    type: code
    pass_when: "commitScene implementation does not call applyPipeline; only buildFrameFromScene + trajectory/DS update + markAllSaved"
    status: verified
    last_checked: 2026-07-30
  - id: ac-005
    summary: "Analysis surfaces a save prompt when scene is dirty"
    type: code
    pass_when: "Page analysis path checks hasUnsavedChanges (or dirty-change) and shows save guidance while disabling Run"
    status: verified
    last_checked: 2026-07-30
  - id: ac-006
    summary: "Public API names commitScene/discardScene; save aliases commitScene if retained"
    type: code
    pass_when: "stage exports or documents commitScene; call sites in edit/manipulate/vsc-ext use commitScene (or alias)"
    status: verified
    last_checked: 2026-07-30
out_of_scope:
  - Independent 3D MoleculeGraph document type
  - Sketch package changes
  - Lazy commit on analysis open/run
---

# Acceptance — stage-commit-scene

Done means Stage has a single git-like commit boundary (`commitScene`) for molrs
HEAD, free mode switching over a parked working tree, and page analysis that
refuses to run until the user commits.

## AC-001 — commit installs HEAD

Empty pipeline + edit-pool atoms → `commitScene` → structure visible to
`frameHasStructure` and one MemoryDataSource when none existed.

## AC-002 — no auto-commit

Command/history path never writes system.frame; dirty flag set until explicit
commit.

## AC-003 — discard = checkout HEAD

Working tree matches committed frame after discard; dirty cleared.

## AC-004 — no pipeline rebuild on commit

Engineering choice from grill: commit is dump-only.

## AC-005 — analysis waits for user

Dirty → prompt save, Run disabled.

## AC-006 — naming

`commitScene` / `discardScene` are the primary verbs.
