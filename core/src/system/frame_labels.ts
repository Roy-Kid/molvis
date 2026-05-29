import type { Trajectory } from "./trajectory";

/**
 * Walk a trajectory once and bucket every numeric `frame.meta` key into a
 * per-frame column. Keys whose value never parses to a finite number on any
 * frame are dropped (they are purely categorical). Missing or non-numeric
 * entries for an otherwise-numeric key are stored as `NaN`.
 *
 * This is the single materialisation point for per-frame descriptors — the
 * resulting `Map<name, Float64Array>` is cached on `System.frameLabels` and
 * fed directly to {@link runExploration}, so the UI never walks frame meta.
 *
 * For ExtXYZ trajectories the keys come from comment-line `key=value` pairs.
 * Non-XYZ formats expose no `frame.meta`, so the map comes back empty.
 */
export function aggregateFrameLabels(
  trajectory: Trajectory,
): Map<string, Float64Array> {
  const nFrames = trajectory.length;
  const out = new Map<string, Float64Array>();
  if (nFrames === 0) return out;

  // Resolve each frame once (a lazy provider would otherwise refetch per key).
  const frames = Array.from({ length: nFrames }, (_, i) => trajectory.get(i));

  const names = new Set<string>();
  for (const frame of frames) {
    if (!frame) continue;
    for (const name of frame.metaNames()) names.add(name);
  }

  for (const name of names) {
    const column = new Float64Array(nFrames).fill(Number.NaN);
    let anyNumeric = false;
    for (let i = 0; i < nFrames; i++) {
      const v = frames[i]?.getMetaScalar(name);
      if (v !== undefined && Number.isFinite(v)) {
        column[i] = v;
        anyNumeric = true;
      }
    }
    if (anyNumeric) out.set(name, column);
  }

  return out;
}
