/**
 * Convex envelope of a molecule.
 *
 * The classical convex hull is defined over points, but every other surface
 * algorithm here respects atom radii, and a hull of bare centres sits visibly
 * inside the molecule. Worse, a planar molecule — benzene — has a
 * zero-volume hull of centres, so asking for its surface would draw nothing.
 *
 * So the hull runs over points sampled on each atom's van der Waals sphere.
 * That keeps it consistent with the other algorithms, gives it the same
 * `radiusScale` knob, and makes flat molecules solid for free. The cost is a
 * faceting error of at most `r·(1 − cos(θ/2))` for sample spacing `θ`; at
 * {@link SAMPLES_PER_ATOM} points that is under 0.1 Å.
 */

import type { SurfaceMesh } from "../surface_mesh";
import { AtomRadii } from "./atom_radii";
import { ConvexHull } from "./convex_hull";

/** Fibonacci-sphere directions per atom. 42 keeps faceting under ~0.1 Å. */
export const SAMPLES_PER_ATOM = 42;

export interface HullSurfaceInput {
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  z: ArrayLike<number>;
  count: number;
  elements?: readonly string[];
}

export interface HullSurfaceOptions {
  /** Multiplier on tabulated van der Waals radii. */
  radiusScale: number;
}

/** Construct, then read {@link mesh}. */
export class HullSurface {
  readonly mesh: SurfaceMesh;
  readonly usedFallbackRadius: boolean;
  /** True when the atoms cannot span a volume — fewer than two, say. */
  readonly degenerate: boolean;

  constructor(input: HullSurfaceInput, options: HullSurfaceOptions) {
    const radii = new AtomRadii(input.count, input.elements, {
      scale: options.radiusScale,
    });
    const hull = new ConvexHull(sampleSpheres(input, radii.values));
    this.mesh = hull.mesh;
    this.degenerate = hull.degenerate;
    this.usedFallbackRadius = radii.usedFallback;
  }
}

/** Evenly spread directions on the unit sphere, offset each atom's centre. */
function sampleSpheres(
  input: HullSurfaceInput,
  radii: Float64Array,
): { x: Float64Array; y: Float64Array; z: Float64Array; count: number } {
  const directions = fibonacciSphere(SAMPLES_PER_ATOM);
  const total = input.count * SAMPLES_PER_ATOM;
  const x = new Float64Array(total);
  const y = new Float64Array(total);
  const z = new Float64Array(total);

  let at = 0;
  for (let a = 0; a < input.count; a++) {
    const r = radii[a];
    for (let d = 0; d < SAMPLES_PER_ATOM; d++) {
      const base = d * 3;
      x[at] = input.x[a] + r * directions[base];
      y[at] = input.y[a] + r * directions[base + 1];
      z[at] = input.z[a] + r * directions[base + 2];
      at++;
    }
  }
  return { x, y, z, count: total };
}

/** Flat xyz triples, `count` unit vectors spiralled by the golden angle. */
function fibonacciSphere(count: number): Float64Array {
  const out = new Float64Array(count * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const z = 1 - (2 * i + 1) / count;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const theta = i * goldenAngle;
    out[i * 3] = r * Math.cos(theta);
    out[i * 3 + 1] = r * Math.sin(theta);
    out[i * 3 + 2] = z;
  }
  return out;
}
