---
slug: advanced-reset-camera
criteria:
  - id: ac-001
    summary: getBounds expands the scene box by each atom's vdW radius
    type: code
    evaluator_hint: "core/tests/world_reset_camera.test.ts"
    pass_when: |
      A test loads a scene with one large-radius edge atom; radius-aware
      getBounds() returns min <= center-r and max >= center+r for that
      atom on the relevant axis (the r at instanceData stride idx+3 is no
      longer dropped).
    status: pending
  - id: ac-002
    summary: Per-axis fit tightens wide (aspect>1) framing
    type: code
    evaluator_hint: "core/tests/camera_fit.test.ts"
    pass_when: |
      For a horizontally wide box at aspect>1, the new fit distance is
      <= the legacy vertical-FOV-only distance, and frames the box width
      to the horizontal FOV (distance == halfWidth / tan(theta_h) * FIT_PADDING
      when width-limited).
    status: pending
  - id: ac-003
    summary: Portrait (aspect<1) fit stays bit-equivalent to legacy
    type: code
    evaluator_hint: "core/tests/camera_fit.test.ts"
    pass_when: |
      The existing camera-trajectory-turntable ac-005 characterization
      and the aspect<1 cases in camera_fit.test.ts pass unchanged:
      fitBoundsToView(bounds, fov, aspect<1) returns the same center/radius
      (within 1e-6) as the legacy implementation.
    status: pending
  - id: ac-004
    summary: symEig3x3 / computeObb recover correct principal axes
    type: code
    evaluator_hint: "core/tests/camera_obb.test.ts"
    pass_when: |
      For an axis-aligned box, computeObb returns axes equal to the world
      axes (up to sign, within 1e-9) with halfExtents matching the box;
      eigenvalues are ordered descending and eigenvectors orthonormal.
    status: pending
  - id: ac-005
    summary: OBB framing beats AABB for a diagonal rod
    type: code
    evaluator_hint: "core/tests/camera_obb.test.ts"
    pass_when: |
      For a thin rod along (1,1,1), fitBoxToView using computeObb yields a
      framing distance <= 0.7x the fitBoundsToView (AABB) distance for the
      same points (over-padding removed).
    status: pending
  - id: ac-006
    summary: PBC box corners are inside the frustum when box framing is on
    type: code
    evaluator_hint: "core/tests/world_reset_camera.test.ts"
    pass_when: |
      With frame.simbox present and frameBox enabled, resetCamera frames a
      point set including all 8 box corners (from box.hMatrix() column
      vectors + origin); a test asserts each corner lies within the framed
      view's center/radius bound.
    status: pending
  - id: ac-007
    summary: auto view looks along the minor principal axis
    type: code
    evaluator_hint: "core/tests/camera_auto_view.test.ts"
    pass_when: |
      For an elongated structure, pickViewDirection returns alpha/beta whose
      view vector aligns (within tolerance) with the OBB's minor axis (lambda_3),
      maximizing projected silhouette.
    status: pending
  - id: ac-008
    summary: default iso view direction is backward-compatible
    type: code
    evaluator_hint: "core/tests/world_reset_camera.test.ts"
    pass_when: |
      resetCamera() with no options (or viewDirection="iso") leaves
      camera.alpha == PI/4 and camera.beta == PI/3 (within 1e-9), matching
      the pre-change behavior.
    status: pending
  - id: ac-009
    summary: degenerate inputs are stable (no throw, no NaN)
    type: code
    evaluator_hint: "core/tests/camera_obb.test.ts"
    pass_when: |
      computeObb on a single atom, collinear points, and an isotropic sphere
      sets degenerate=true, returns finite axes (world axes) and finite
      half-extents, and pickViewDirection falls back to iso angles; no NaN
      appears in any returned field.
    status: pending
  - id: ac-010
    summary: turntable shared-fit surface still builds
    type: code
    evaluator_hint: "core/tests/camera_animator.test.ts"
    pass_when: |
      CameraAnimator.buildTurntable produces a TurntableTrack with finite
      center/radius for a known bounds, and all existing camera_* tests
      pass after the fit.ts upgrade.
    status: pending
  - id: ac-011
    summary: full check + test suite is green
    type: runtime
    evaluator_hint: "npm run typecheck && npm test"
    pass_when: |
      npm run typecheck and npm test both exit 0 with the new camera_obb /
      camera_auto_view / world_reset_camera tests included.
    status: pending
---

# Acceptance criteria

- **ac-001 radius-aware bounds** — fixes defect 1; the per-atom radius at `instanceData` stride `idx+3` (dropped today at `scene_index.ts:947-949`) is folded into the box.
- **ac-002 / ac-003 per-axis fit** — fixes defect 2; wide viewports tighten, portrait stays exactly as before so the prior spec's ac-005 lock holds.
- **ac-004 / ac-005 OBB** — fixes defect 3; correct principal axes plus a measurable distance win over AABB for diagonal/elongated structures.
- **ac-006 PBC box framing** — fixes defect 4; all 8 cell corners visible when box framing is enabled.
- **ac-007 / ac-008 auto view** — fixes defect 5; auto is opt-in along the minor axis, default remains the stable iso angle (backward compatible).
- **ac-009 degeneracy** — guards the FP-fragile near-degenerate eigenvalue case recorded in core-arch.md; stable, deterministic fallback, never NaN.
- **ac-010 shared surface** — `fitBoundsToView` signature/semantics preserved so turntable and its acceptance lock are unaffected.
- **ac-011 suite** — overall green gate.
