---
name: molvis-iterate
description: Start a product iteration cycle. The lead agent analyzes MolVis's current state, proposes the single most impactful next improvement, and waits for approval before any implementation.
argument-hint: "[optional focus area or constraint]"
user-invocable: true
---

Begin a new product iteration for MolVis.

Use the **molvis-lead** agent to drive this process. The lead agent will:

1. **Analyze** — Read CLAUDE.md, recent git log, codebase state, test coverage, incomplete work, and any existing iteration history
2. **Propose** — Select ONE improvement and present it using the standard iteration proposal format
3. **Wait** — Do NOT proceed to implementation. Present the proposal and ask for: **Approve**, **Modify**, or **Reject**

If the user provides a focus area via $ARGUMENTS (e.g., "rendering", "file formats", "test coverage"), the lead agent should prioritize candidates in that area while still justifying the choice against alternatives.

**CRITICAL**: This skill produces a PLAN, not code. Implementation only begins after explicit user approval, at which point the approved spec is passed to `/molvis-impl`.
