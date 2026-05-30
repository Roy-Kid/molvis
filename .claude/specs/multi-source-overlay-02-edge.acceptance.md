---
slug: multi-source-overlay-02-edge
criteria:
  - id: ac-001
    summary: Modifier interface and BaseModifier expose referencedIds default []
    type: code
    pass_when: |
      core/src/pipeline/modifier.ts declares `referencedIds: string[]` on the
      Modifier interface and BaseModifier initializes it to an empty array.
    status: pending
  - id: ac-002
    summary: PipelineContext carries frameCache initialized empty
    type: code
    pass_when: |
      core/src/pipeline/types.ts adds `frameCache: Map<string, Frame>` to
      PipelineContext and createDefaultContext sets it to `new Map()`.
    status: pending
  - id: ac-003
    summary: Consumer reads correct referenced branch output from frameCache
    type: runtime
    pass_when: |
      In reference_edge.test.ts, a consumer with referencedIds=[branchId]
      reads the branch's tagged output frame via context.frameCache and the
      assertion on the branch's distinguishing block/column passes.
    status: pending
  - id: ac-004
    summary: Branch not in referencedIds is invisible to the consumer
    type: runtime
    pass_when: |
      Test asserting a consumer cannot observe a branch absent from its
      referencedIds passes (frameCache lookup of the un-referenced id yields
      no influence on the consumer's recorded output).
    status: pending
  - id: ac-005
    summary: setReferences rejects self-reference
    type: runtime
    pass_when: |
      setReferences(x, [x]) returns false and x.referencedIds is unchanged.
    status: pending
  - id: ac-006
    summary: setReferences rejects reference cycles
    type: runtime
    pass_when: |
      With x referencing y, setReferences(y, [x]) returns false and y's
      referencedIds is unchanged.
    status: pending
  - id: ac-007
    summary: setReferences rejects dangling referenced id
    type: runtime
    pass_when: |
      setReferences(x, ["unknown"]) returns false and x.referencedIds is
      unchanged.
    status: pending
  - id: ac-008
    summary: Disabled referenced branch treated as absent with warning, no throw
    type: runtime
    pass_when: |
      With the referenced branch enabled=false, compute() resolves without
      throwing, the consumer observes the branch as absent, and a warning is
      emitted (spy/captured logger.warn).
    status: pending
  - id: ac-009
    summary: Removing referenced modifier auto-drops the ref without deleting consumer
    type: runtime
    pass_when: |
      After removeModifier(branchId), the consumer remains in the pipeline and
      its referencedIds no longer contains branchId.
    status: pending
  - id: ac-010
    summary: Referenced branch output computed before consumer; forward ref warns
    type: runtime
    pass_when: |
      When the branch precedes the consumer in array order, the consumer reads
      the branch output; when it follows, compute() warns and the consumer
      observes the branch as absent.
    status: pending
  - id: ac-011
    summary: pipeline.set_references RPC wires id + referenced_ids to setReferences
    type: code
    pass_when: |
      router.ts registers "pipeline.set_references", reads {id, referenced_ids},
      calls modifierPipeline.setReferences, throws invalidParams on failure, and
      calls applyPipeline({ fullRebuild: true }) on success.
    status: pending
  - id: ac-012
    summary: Full check and test suite pass
    type: runtime
    pass_when: |
      `npm run typecheck`, `npm run lint`, and `npm test` all exit 0.
    status: pending
---

# Acceptance criteria

- **ac-001 / ac-002** static field/type additions verifiable by reading source.
- **ac-003 / ac-004** the core happy-path + isolation guarantees of the reference edge.
- **ac-005..ac-007** integrity gate on `setReferences` (self / cycle / dangling).
- **ac-008** disabled-branch degradation: treat-as-absent + warn, never throw.
- **ac-009** removal auto-drop without cascade-delete of consumer.
- **ac-010** ordering guarantee (referenced-before-consumer) and forward-ref warning.
- **ac-011** minimal RPC surface for setting/clearing references.
- **ac-012** repo-wide gate.
