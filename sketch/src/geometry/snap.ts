import type { MoleculeGraph } from "../molecule_graph";

/** Default bond length in document units. */
export const DEFAULT_BOND_LENGTH = 1.0;

/** Snap radius as fraction of DEFAULT_BOND_LENGTH. */
export const SNAP_RADIUS = 0.35 * DEFAULT_BOND_LENGTH;

/**
 * Nearest atom within radius, or null. Ties break by lower index.
 */
export function findAtom(
  graph: MoleculeGraph,
  x: number,
  y: number,
  radius: number = SNAP_RADIUS,
): number | null {
  const data = graph.getMoleculeData();
  let best: number | null = null;
  let bestD = radius;
  for (let i = 0; i < data.atoms.length; i++) {
    const a = data.atoms[i];
    const d = Math.hypot(a.x - x, a.y - y);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
