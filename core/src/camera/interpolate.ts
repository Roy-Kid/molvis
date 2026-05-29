/**
 * Pose interpolation for keyframe-based camera trajectories.
 *
 * Deferred (v1 ships only the analytic {@link TurntableTrack}). A future
 * `KeyframeTrack` will interpolate position via Catmull-Rom and orientation
 * via slerp/lerp, then implement {@link CameraTrack} so the animator needs no
 * changes. Intentionally left as a stub — see `.claude/specs` (out of scope).
 */

export {};
