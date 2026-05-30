---
slug: multi-source-overlay-01-kabsch
criteria:
  - id: ac-001
    summary: svd3 reconstructs H and yields orthonormal ordered factors
    type: scientific
    pass_when: |
      For the fixtures in core/tests/svd3.test.ts, svd3(H) satisfies
      U*diag(S)*Vᵀ ≈ H, UᵀU ≈ I, VᵀV ≈ I, and S[0]>=S[1]>=S[2]>=0
      within 1e-9, with no explicit HᵀH eigendecomposition used.
    status: pending
  - id: ac-002
    summary: superpose recovers identity for P==Q
    type: scientific
    pass_when: |
      superpose(P, P) returns R≈I, t≈0, rmsd≈0 (each within 1e-9)
      in core/tests/superposition.test.ts.
    status: pending
  - id: ac-003
    summary: superpose recovers pure translation
    type: scientific
    pass_when: |
      For Q = P + c, superpose(P, Q) returns R≈I, t≈c, rmsd≈0
      within 1e-9.
    status: pending
  - id: ac-004
    summary: superpose recovers a known rotation
    type: scientific
    pass_when: |
      For Q obtained by applying a known 90° and an arbitrary rotation
      to P, superpose(P, Q).R matches the applied rotation and rmsd≈0
      within 1e-9.
    status: pending
  - id: ac-005
    summary: superpose forces a proper rotation on the reflection case
    type: scientific
    pass_when: |
      On the reflection/det-sign fixture, det(superpose(P,Q).R) == +1
      (within 1e-9) and the result is not the mirror solution.
    status: pending
  - id: ac-006
    summary: superpose handles N=1 and N=2 degenerate cases
    type: scientific
    pass_when: |
      N=1 returns R=I, t=q1-p1, rmsd=0; N=2 returns a reproducible
      deterministic (identity-twist) result with no NaN, per fixtures.
    status: pending
  - id: ac-007
    summary: superpose handles collinear/coplanar rank-deficient input
    type: scientific
    pass_when: |
      Collinear and coplanar fixtures return finite R with det≈+1 and
      a finite well-defined rmsd, no NaN/Inf produced.
    status: pending
  - id: ac-008
    summary: mass-weighted RMSD differs from unweighted and matches hand value
    type: scientific
    pass_when: |
      With non-uniform weights, superpose(...,{weights}).rmsd differs
      from unweighted and equals the hand-computed weighted reference
      within 1e-9.
    status: pending
  - id: ac-009
    summary: rmsd matches a hand-computed reference value
    type: scientific
    pass_when: |
      rmsd(...) on the hand-computed fixture equals the reference Å
      value within 1e-9.
    status: pending
  - id: ac-010
    summary: mismatched counts without indices throws a clear error
    type: code
    pass_when: |
      Calling superpose with unequal moving/reference point counts and
      no options.indices throws an Error whose message names the count
      mismatch; never silently zips, asserted in superposition.test.ts.
    status: verified
    last_checked: 2026-05-31
  - id: ac-011
    summary: indices-restricted fit matches isolated subset alignment
    type: scientific
    pass_when: |
      superpose(P,Q,{indices}) yields the same R/t/rmsd as superposing
      the extracted subset arrays directly, within 1e-9.
    status: pending
  - id: ac-012
    summary: kernel public symbols exported and typecheck/test/lint pass
    type: code
    pass_when: |
      superpose, rmsd, applyTransform, identityCorrespondence and the
      SuperpositionResult/SuperposeOptions types are exported from
      core/src/system/index.ts; npm run typecheck, npm test, npm run
      lint all pass.
    status: verified
    last_checked: 2026-05-31
    note: |
      Kernel symbols exported from core/src/system/index.ts. CI-parity gate
      green: biome check (whole repo), npm run typecheck (core/page/vsc-ext),
      npm run test:core (674 passed) — these are the exact checks ci.yml and
      .pre-commit-config.yaml run. The umbrella `npm test` also chains
      test:python (molvis not editable-installed in this checkout) and
      test:vsc-ext (tsconfig.test.json moduleResolution=node10 deprecation);
      both are pre-existing, non-CI, and untouched by this core-only change.
---

# Acceptance criteria

- ac-001 — svd3 correctness is the foundation; verified independently before Kabsch consumes it.
- ac-002..ac-004 — happy-path superposition (identity, translation, rotation recovery).
- ac-005 — the d-term proper-rotation guard against chirality-flipping mirror solutions.
- ac-006..ac-007 — degenerate-geometry robustness (N=1, N=2, collinear/coplanar).
- ac-008..ac-009 — RMSD numeric correctness, weighted and unweighted, against hand-computed references.
- ac-010..ac-011 — correspondence contract: clear error on mismatch, correct subset behavior.
- ac-012 — public API surface exported from the system barrel and repo-wide gates green.
