---
slug: camera-trajectory-turntable
criteria:
  - id: ac-001
    summary: TurntableTrack.sample lands on the orbit circle for all t
    type: code
    pass_when: |
      A unit test in core/tests/camera/track.test.ts asserts that for
      t in {0, 0.25, 0.5, 0.75, 1}, |sample(t).position - center| equals
      radius within 1e-6, and target equals center.
    status: verified
    last_checked: 2026-05-29
  - id: ac-002
    summary: theta scales linearly with revolutions
    type: code
    pass_when: |
      A unit test asserts that for fixed t the angular position derived
      from sample(t).position about center is 2*PI*revolutions*t, and that
      doubling revolutions doubles that angle.
    status: verified
    last_checked: 2026-05-29
  - id: ac-003
    summary: TurntableTrack loop closes over a whole revolution
    type: code
    pass_when: |
      A unit test asserts sample(1) equals sample(0) within 1e-6 for an
      integer revolutions value.
    status: verified
    last_checked: 2026-05-29
  - id: ac-004
    summary: Pose up/fov default to camera current values when omitted
    type: code
    pass_when: |
      A unit test calls applyPose with a pose lacking up and fov and
      asserts the camera's upVector and fov are left at their prior values.
    status: verified
    last_checked: 2026-05-29
  - id: ac-005
    summary: Shared fit helper matches prior inline resetCamera framing
    type: code
    pass_when: |
      A characterization test in core/tests/camera/fit.test.ts asserts
      fitBoundsToView returns the same center/radius (within 1e-6) that the
      pre-refactor resetCamera produced for a known bounding box, including
      aspect correction, 1.2x padding, and the 5.0 min-distance clamp.
    status: verified
    last_checked: 2026-05-29
  - id: ac-006
    summary: seek does not mutate the main ArcRotateCamera
    type: code
    pass_when: |
      A unit test records mainCamera alpha/beta/radius, calls
      animator.seek(0.5), and asserts those three values are unchanged.
    status: verified
    last_checked: 2026-05-29
  - id: ac-007
    summary: play registers exactly one observer (double-add guard)
    type: runtime
    pass_when: |
      A test calls play() twice and asserts
      scene.onBeforeRenderObservable holds exactly one animator observer,
      and stop() removes it (count returns to baseline).
    status: verified
    last_checked: 2026-05-29
  - id: ac-008
    summary: stop restores scene.activeCamera to the main camera
    type: runtime
    pass_when: |
      A test calls play() then stop() and asserts scene.activeCamera is
      the main ArcRotateCamera and animator's stored observer field is cleared.
    status: verified
    last_checked: 2026-05-29
  - id: ac-009
    summary: renderFrames restores main camera on completion and on error
    type: runtime
    pass_when: |
      One test asserts scene.activeCamera is the main camera after a normal
      renderFrames call; a second test makes a per-frame screenshot throw and
      asserts the main camera is still restored (try/finally).
    status: verified
    last_checked: 2026-05-29
  - id: ac-010
    summary: renderFrames is counter-driven and frame-rate-independent
    type: runtime
    pass_when: |
      A test asserts renderFrames({duration,fps,revolutions}) calls seek with
      i/total for i in [0,total) (total = round(duration*fps)) and returns a
      dataURL[] of that length, independent of wall-clock timing.
    status: verified
    last_checked: 2026-05-29
  - id: ac-011
    summary: CameraAnimator owns its own DirectionalLight parented to animCamera
    type: runtime
    pass_when: |
      A test asserts the animator constructs a DirectionalLight whose parent
      is animCamera with intensity 0.48 and specular (0.6,0.6,0.6), distinct
      from world's main-camera-parented dirLight.
    status: verified
    last_checked: 2026-05-29
  - id: ac-012
    summary: renderFrames drives frames through world.renderOnce()
    type: runtime
    pass_when: |
      A test spies on world.renderOnce and asserts renderFrames invokes it
      once per frame (not bare scene.render), so axisHelper + overlay screen
      positions update per exported frame.
    status: verified
    last_checked: 2026-05-29
  - id: ac-013
    summary: animCamera uses its own fov/minZ/maxZ from viewportSettings, not ortho-zoom sync
    type: runtime
    pass_when: |
      A test asserts animCamera.fov/minZ/maxZ equal world.viewportSettings
      getConfig() values at construction, and that animCamera is not mutated
      by the ortho-zoom onBeforeRender sync (UniversalCamera unaffected).
    status: verified
    last_checked: 2026-05-29
  - id: ac-014
    summary: animate_camera command registers and undo returns this
    type: code
    pass_when: |
      A test asserts commands registry resolves "animate_camera" after
      registerDefaultCommands(), and the command's undo() returns the command
      instance (transient, no NoOpCommand).
    status: verified
    last_checked: 2026-05-29
  - id: ac-015
    summary: core emits only dataURL[]; no encoding deps in core
    type: code
    pass_when: |
      app.exportTurntable resolves to string[] of PNG data URLs, and core/
      package.json declares no GIF/WebM encoding dependency (gif.js etc.
      appear only under page/).
    status: verified
    last_checked: 2026-05-29
  - id: ac-016
    summary: Fullscreen camera-trajectory overlay exposes controls, preview, export
    type: ui_runtime
    evaluator_hint: mol:web
    pass_when: |
      In the running app, entering fullscreen (canvas-only) shows a
      camera-trajectory overlay with duration/revolutions/export-fps controls,
      a play/stop preview toggle, and an export button; play starts an orbit
      preview and exiting fullscreen stops it and restores the interactive view.
    status: pending
  - id: ac-017
    summary: Exported frames are correctly lit, framed, and downloadable as GIF/WebM
    type: ui_runtime
    evaluator_hint: mol:web
    pass_when: |
      In the running app, clicking export produces a GIF/WebM download whose
      frames show the molecule fully framed and lit (key light follows the
      orbit), confirming the animator's own light and shared fit framing.
    status: pending
---

# Acceptance criteria

- ac-001..004 — turntable geometry and pose defaults (pure-function unit tests, RED-before-GREEN).
- ac-005 — shared fit helper characterization; guards that the `resetCamera` refactor preserves framing.
- ac-006 — view-preservation: `seek` never touches the interactive `ArcRotateCamera`.
- ac-007..010 — `CameraAnimator` lifecycle: single-observer guard, activeCamera restore, error-safe + counter-driven `renderFrames`.
- ac-011..013 — the three codebase coupling points: (1) own light parented to `animCamera`, (2) frames driven through `renderOnce()` so chrome stays consistent, (3) own fov/clip from `viewportSettings` with no ortho-zoom-sync participation.
- ac-014..015 — command registration/transient-undo and the core-stays-encoding-free boundary.
- ac-016..017 — View-tab UI and the visually-verified lit/framed export (`ui_runtime`, verified later against the running app per the no-E2E rule).
