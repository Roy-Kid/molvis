/**
 * Apply the system wrap gate to a composed frame.
 *
 * When enabled and the frame has a usable box, every atom column is folded
 * with {@link wrapAtoms}. Bonds / ribbon / density are not rewritten here —
 * they consume the post-gate frame (bonds via draw-time MI).
 */

import type { Frame } from "@molcrafts/molvis-core/molrs";
import { shouldDrawBox } from "../io/box_presence";
import { frameWithCoords, readAtomCoords } from "./frame_coords";
import { wrapAtoms } from "./wrap";

/**
 * Fold atom coordinates into `frame.box` when `wrapEnabled` is true.
 * No-op (same frame reference) when disabled, coords missing, or no usable box.
 */
export function applyWrapIfEnabled(frame: Frame, wrapEnabled: boolean): Frame {
  if (!wrapEnabled) return frame;

  const coords = readAtomCoords(frame);
  if (!coords || coords.n === 0) return frame;

  const box = frame.box;
  if (!shouldDrawBox(box)) return frame;

  const w = wrapAtoms(box, coords.x, coords.y, coords.z, coords.n);
  return frameWithCoords(frame, w.x, w.y, w.z);
}
