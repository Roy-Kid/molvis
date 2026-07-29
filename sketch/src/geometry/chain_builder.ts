import { DEFAULT_BOND_LENGTH } from "./snap";

export interface ChainGeometry {
  /** Points including start (may be existing atom). */
  points: Array<{ x: number; y: number }>;
}

/**
 * Build carbon chain points from start toward end with fixed bond length.
 * Returns only intermediate+end points (not start) as new atoms.
 */
export function buildChainPoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  step: number = DEFAULT_BOND_LENGTH,
): ChainGeometry {
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.hypot(dx, dy);
  if (dist < step * 0.5) {
    return { points: [] };
  }
  const nSeg = Math.max(1, Math.round(dist / step));
  const ux = dx / dist;
  const uy = dy / dist;
  const points: Array<{ x: number; y: number }> = [];
  for (let s = 1; s <= nSeg; s++) {
    points.push({ x: startX + ux * step * s, y: startY + uy * step * s });
  }
  return { points };
}
