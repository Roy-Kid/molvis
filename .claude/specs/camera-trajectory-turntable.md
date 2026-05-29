---
title: Programmable Camera Trajectory System (Turntable v1)
status: code-complete
created: 2026-05-29
---

# Programmable Camera Trajectory System (Turntable v1)

## Summary

MolVis gains a programmable camera trajectory system whose first concrete track is a turntable rotation: the camera orbits the rendered scene on a circle and returns to its start after a whole number of revolutions. Users drive it from the View tab — set the speed, toggle a live preview, and export a deterministic, frame-rate-independent sequence of PNG frames that the page encodes to GIF or WebM and downloads. The system is pose-based and camera-agnostic, so future fly-through paths plug in without touching the animator, and it renders through its own dedicated camera and light so the user's interactive view is never mutated and export frames are correctly lit and framed.

## Domain basis

The turntable is pure geometry, not keyframe interpolation. A turntable track parameterizes a circle of radius `r` around a center `c` in the camera's horizontal plane: for normalized time `t in [0,1]` and `revolutions` whole turns, `theta = 2*PI*revolutions*t`, and the camera position is `c + r*(cos(theta)*u + sin(theta)*v)` where `u, v` are two orthonormal basis vectors spanning the orbit plane (target stays at `c`). `r` and `c` come from the shared scene-fit helper (FOV + aspect correction + 1.2x padding + min-distance clamp), so the orbit always frames whatever is rendered.

The pitfall that forces analytic sampling: a keyframe-lerp turntable (sampling N points on the circle and linearly interpolating between them) draws chords, and a chord between two points on a circle passes *inside* the circle — at the extreme, a chord through diametrically opposite samples passes through the center `c`, clipping the camera straight into the molecule. Analytic `sample(t)` always lands exactly on the circle, so `|sample(t).position - c| == r` holds for every `t`, never just at the sampled knots. Loop closure for a whole revolution requires `sample(1) == sample(0)` (since `cos/sin` are `2*PI`-periodic and `revolutions` is an integer).

## Design

A camera trajectory is modeled as a camera **pose** over time, never as `ArcRotateCamera` `alpha/beta/radius`. This is the load-bearing extensibility decision: poses are camera-rig-agnostic, so a future `KeyframeTrack` reuses the entire animator unchanged.

- **`CameraPose`** = `{ position: Vec3; target: Vec3; up?: Vec3; fov?: number }`. `applyPose(camera, pose)` positions a Babylon camera from a pose; omitted `up`/`fov` fall back to the camera's current values.
- **`CameraTrack`** = `{ duration: number; loop: boolean; sample(t: number): CameraPose }`, `t in [0,1]`. The interface is deliberately shaped so `KeyframeTrack` (deferred) drops in with zero animator changes.
- **`TurntableTrack`** implements `sample(t)` analytically per Domain basis. It is the only track kind shipped in v1.
- **Shared fit helper** (`fitBoundsToView`): the `bounds -> {center, radius}` math currently inline in `resetCamera()` (FOV + aspect + 1.2x padding + min-distance clamp, sourced from `world.sceneIndex.getBounds()` — scene-space, not atoms-only) is extracted so `resetCamera` and `TurntableTrack` share one definition and framing cannot drift.
- **`CameraAnimator`** owns a dedicated `UniversalCamera` (`animCamera`, never `attachControl`'d) constructed in the `World` constructor and exposed as `world.cameraAnimator`. Ownership lives in `World` (not `MolvisApp`) to keep all Babylon-camera ownership in one layer. It also owns its **own `DirectionalLight` parented to `animCamera`**, mirroring the main key light's intensity (0.48) and specular ((0.6,0.6,0.6)), because the existing `dirLight` is parented to the main camera and would not follow `animCamera`. The animator reads its own `fov`/`minZ`/`maxZ` from `world.viewportSettings.getConfig()` at construction; it deliberately does **not** participate in the ortho-zoom `onBeforeRender` sync (a `UniversalCamera` is unaffected by it).
  - `play()` — sets `scene.activeCamera = animCamera`, drives `t` via `scene.onBeforeRenderObservable` using `engine.getDeltaTime()` (never `Date.now()`), calls `seek(t % 1)`. Stores the returned `Observer` as a field; guards against double-add and re-issue mid-flight via an interaction-epoch counter, mirroring `BaseMode`.
  - `stop()` — sets `scene.activeCamera = mainCamera`; removes the observer via `observable.remove()`. The user's interactive view is never mutated.
  - `seek(t)` — pure positioning: `applyPose(animCamera, track.sample(t))`. Shared by preview (deltaTime-driven) and export (counter-driven).
  - `dispose()` — removes the observer, frees the owned `UniversalCamera` and owned light.
  - `renderFrames({duration, fps, revolutions})` — switches `activeCamera` to `animCamera`; for `i in [0, total)` calls `seek(i/total)` then `world.renderOnce()` then `await app.screenshot()`; restores `mainCamera` at the end **and on error** (try/finally). Returns a `string[]` of PNG data URLs. Deterministic and frame-rate-independent (counter-driven, not clock-driven).
- **`exportTurntable(opts)`** on `MolvisApp` is a thin async sibling of `screenshot()` that delegates to `cameraAnimator.renderFrames(...)`. It calls `app.screenshot()` per pose (reusing its transparent-bg save/restore and autocrop) and never re-invokes `Tools.CreateScreenshot*` directly. No command, no undo residue.
- **`@command("animate_camera")`** starts a preview. `undo()` returns `this` (transient — follows `TakeSnapshotCommand` precedent, not `DrawBoxCommand`'s `NoOpCommand`). Added to `commands/index.ts` side-effect barrel; the `package.json` `sideEffects` glob `./src/commands/*.ts` already covers it.
- **`renderOnce()` decision**: `renderFrames` drives frames through `world.renderOnce()`, so export frames carry the same chrome (axis helper, overlay screen-positions) as the live view. (Stated as a binding criterion below.)
- **UI** lives in the fullscreen (canvas-only) view as a floating `CameraTrajectoryOverlay` (`page/src/ui/modes/view/CameraTrajectoryOverlay.tsx`): fullscreen is the "compose a shot" mode, so the turntable controls (duration / revolutions / export-fps, a play/stop preview toggle, an export button) live there rather than in the sidebar. The overlay stops any running preview on unmount, so leaving fullscreen restores the user's interactive view. The export button calls `app.exportTurntable`, receives `dataURL[]`, and a page-local `gif-encode.ts` encodes WebM (`MediaRecorder`) and triggers download. Encoding stays in `page/` — core ships only `dataURL[]` and pulls in no encoding deps.

## Files to create or modify

- `core/src/camera/pose.ts` (new) — `CameraPose` type + `applyPose(camera, pose)`
- `core/src/camera/track.ts` (new) — `CameraTrack` interface + analytic `TurntableTrack`
- `core/src/camera/interpolate.ts` (new) — deferred pose interpolation (Catmull-Rom + slerp); stub only in v1
- `core/src/camera/fit.ts` (new) — shared `bounds -> {center, radius}` fit helper
- `core/src/camera/animator.ts` (new) — `CameraAnimator`: owns `animCamera` + own light; `play`/`seek`/`stop`/`dispose`/`renderFrames`
- `core/src/commands/camera.ts` (new) — `@command("animate_camera")`
- `core/src/commands/index.ts` — add `CameraAnimateCommand` export + side-effect import
- `core/src/world.ts` — construct `world.cameraAnimator`; refactor `resetCamera` to use the shared fit helper
- `core/src/app.ts` — add `exportTurntable()` thin wrapper (sibling of `screenshot()`)
- `core/src/index.ts` — export new camera public types (`CameraPose`, `CameraTrack`, `TurntableTrack`)
- `page/src/ui/modes/view/CameraTrajectoryOverlay.tsx` (new) — fullscreen-only turntable controls + preview/export
- `page/src/App.tsx` — mount the overlay when `uiHidden` (fullscreen)
- `page/src/ui/modes/view/gif-encode.ts` (new) — `dataURL[]` -> WebM encode + download

## Tasks

- [x] Write failing tests for TurntableTrack.sample analytic geometry + applyPose defaults (core/tests/camera_track.test.ts)
- [x] Implement CameraPose + applyPose in core/src/camera/pose.ts
- [x] Implement CameraTrack interface + analytic TurntableTrack in core/src/camera/track.ts; stub interpolate.ts
- [x] Write failing tests for the shared fit helper + resetCamera characterization (core/tests/camera_fit.test.ts)
- [x] Implement fitBoundsToView in core/src/camera/fit.ts and refactor world.resetCamera to call it
- [x] Write failing tests for CameraAnimator seek/play/stop lifecycle and view-preservation (core/tests/camera_animator.test.ts)
- [x] Implement CameraAnimator (owned animCamera + own DirectionalLight + own fov/clip) in core/src/camera/animator.ts and construct world.cameraAnimator
- [x] Implement renderFrames (renderOnce-driven, counter-driven, restore-on-error) and app.exportTurntable wrapper
- [x] Implement @command("animate_camera") in core/src/commands/camera.ts; wire commands/index.ts barrel + core/src/index.ts public exports
- [x] Implement View-tab turntable controls + export button + gif-encode.ts in page/src/ui/modes/view/
- [x] Add docstrings per project doc style with units (Å for radius/center, t in [0,1], theta in radians)
- [x] Run full check + test suite
- [x] Hygiene cleanup (/mol:simplify): renamed command id camera.animate → animate_camera to match the flat snake_case @command convention; diff otherwise clean

## Testing strategy

Happy path:
- `TurntableTrack.sample(0)`, `sample(0.5)`, `sample(1)` each land on the orbit circle: `|position - center| == radius` within tolerance (1e-6).
- `theta` scales linearly with `revolutions` (doubling revolutions doubles angular position at fixed `t`).
- Loop closure: for a whole revolution, `sample(1)` equals `sample(0)` within tolerance.
- `up`/`fov` default to the camera's current values when omitted from the pose.

Edge cases:
- Degenerate bounds (single atom / zero-size) clamp to the minimum distance via the fit helper without NaN.
- `play()` issued twice registers exactly one observer (double-add guard); re-issue mid-flight is epoch-guarded.
- `renderFrames` restores the main camera both on normal completion and when a per-frame screenshot throws (try/finally).

Domain/coupling validation:
- Shared fit helper: `center`/`radius` for a known bounding box match the previously-inline `resetCamera` result (characterization test guarding the refactor).
- `seek()` is pure positioning: after `seek(t)`, the main `ArcRotateCamera`'s `alpha`/`beta`/`radius` are unchanged.
- `stop()` restores `scene.activeCamera` to the main camera.
- Per project rules, the View-tab UI and the export-frames-are-lit/framed/chrome behaviors are verified later against the running app (no E2E/Playwright); core unit tests cover all logic above.

## Out of scope

- `KeyframeTrack` and free fly-through paths — interface accommodates them, but only `TurntableTrack` ships (alternative of building both upfront rejected: defers untested interpolation math).
- `interpolate.ts` real implementation — stub only in v1.
- RPC `camera.*` methods — UI-only this version (alternative of exposing over RPC deferred until the UI shape settles).
- Camera roll / quaternion orientation — target-based orientation only.
