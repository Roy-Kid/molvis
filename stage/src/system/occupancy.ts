import type { Frame } from "@molcrafts/molvis-core/molrs";

/**
 * Origin-sentinel occupancy — a **molpack convention**, not a general rule.
 *
 * molpack growth dumps keep every not-yet-placed atom parked at the exact
 * origin `(0, 0, 0)` with a stable `nrows`, so that the row count never
 * changes as the structure grows. Two or more atoms sharing the exact origin
 * are therefore read as occupancy sentinels and are not drawn or bonded —
 * otherwise reverse playback could not shrink the GPU instance count back
 * down. A single atom on the origin is a real atom and is kept.
 *
 * The rule is applied in three places — `atom_buffer.ts` (GPU instances),
 * `perceive_bonds.ts` (neighbour search), and `frame_diff.ts` (change
 * classification). It is deliberately **not silent**: when it fires, the draw
 * path (`representation_draw.ts`) emits a user-visible `status-message` naming
 * how many rows were hidden, so a non-molpack file that happens to stack atoms
 * on the origin does not lose them without warning.
 */

export function isExactOrigin(x: number, y: number, z: number): boolean {
  return x === 0 && y === 0 && z === 0;
}

export function originSentinelCount(
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  z: ArrayLike<number>,
  n: number,
): number {
  let origin = 0;
  for (let i = 0; i < n; i++) {
    if (isExactOrigin(x[i], y[i], z[i])) origin += 1;
  }
  return origin;
}

/** Occupied (drawable) atom count. Equals `n` when origin is not a sentinel pile. */
export function occupiedAtomCount(
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  z: ArrayLike<number>,
  n: number,
): number {
  const origin = originSentinelCount(x, y, z, n);
  return origin > 1 ? n - origin : n;
}

export function shouldSkipOriginSentinels(
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  z: ArrayLike<number>,
  n: number,
): boolean {
  return originSentinelCount(x, y, z, n) > 1;
}

// The origin scan walks all three coordinate columns; during playback the same
// immutable Frame is scanned up to 3–4× per step (as `prev` and `next` in
// frame_diff, then again in the draw path). Memoize the occupied count weakly
// on the Frame — mirrors `elementColumnCache` in frame_diff.ts. Entries are
// collected when the Frame is GC'd / freed.
const occupiedCountCache = new WeakMap<Frame, number>();

/**
 * {@link occupiedAtomCount} memoized on `frame`. Callers that hold the owning
 * Frame (draw path, frame diff, perceive) share one scan across the several
 * comparisons a single playback step performs.
 */
export function occupiedAtomCountForFrame(
  frame: Frame,
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  z: ArrayLike<number>,
  n: number,
): number {
  const cached = occupiedCountCache.get(frame);
  if (cached !== undefined) return cached;
  const count = occupiedAtomCount(x, y, z, n);
  occupiedCountCache.set(frame, count);
  return count;
}

/** Frame-memoized {@link shouldSkipOriginSentinels}. */
export function shouldSkipOriginSentinelsForFrame(
  frame: Frame,
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  z: ArrayLike<number>,
  n: number,
): boolean {
  return occupiedAtomCountForFrame(frame, x, y, z, n) < n;
}
