import { DEFAULT_BOND_LENGTH } from "./snap";

export type RingKind = "aliphatic" | "benzene";

export interface RingGeometry {
  kind: RingKind;
  /** Document-space vertices. */
  vertices: Array<{ x: number; y: number }>;
  /** Edges as vertex index pairs. */
  edges: Array<[number, number]>;
}

/**
 * Regular polygon ring template.
 * @param size - ring size 3..8
 * @param cx - center x (document units)
 * @param cy - center y
 * @param radius - circumradius; default DEFAULT_BOND_LENGTH / (2*sin(π/n))
 * @param kind - aliphatic or benzene (same topology; benzene flagged for circle render)
 */
export function buildRingTemplate(
  size: number,
  cx: number,
  cy: number,
  radius?: number,
  kind: RingKind = "aliphatic",
): RingGeometry {
  if (size < 3 || size > 8) {
    throw new Error(`ring size must be 3..8, got ${size}`);
  }
  const r =
    radius !== undefined && radius > 0
      ? radius
      : DEFAULT_BOND_LENGTH / (2 * Math.sin(Math.PI / size));
  const vertices: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < size; i++) {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / size;
    vertices.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < size; i++) {
    edges.push([i, (i + 1) % size]);
  }
  return { kind, vertices, edges };
}
