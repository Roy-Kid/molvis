/**
 * Signed field of a union of balls, deposited by per-atom splatting.
 *
 *   f(p) = maxᵢ (rᵢ − |p − xᵢ|)
 *
 * Positive inside, zero on the surface — the same polarity as the Gaussian
 * density path, so one isovalue of 0 works for every field algorithm.
 *
 * Each ball only writes into its own voxel window, so the cost is
 * `O(N·(r/h)³)` rather than the `O(N·nx·ny·nz)` of a full sweep. Outside every
 * window the field holds {@link BallField.floor}, which is exactly the value a
 * window writes at its own edge — the field stays continuous across the window
 * boundary, so no spurious crossing or NaN normal can appear there.
 */

import type { GridDomain } from "./grid_domain";

/** Window overshoot past each radius, in voxels. Two gives smooth normals. */
const DEFAULT_MARGIN_VOXELS = 2;

export interface BallFieldInput {
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  z: ArrayLike<number>;
  count: number;
  /** Per-atom radius, Å. Already includes any probe offset. */
  radii: ArrayLike<number>;
}

/** Construct against a domain, then read {@link values}. */
export class BallField {
  readonly values: Float64Array;
  /** Field value outside every ball window; also the window-edge value. */
  readonly floor: number;

  constructor(
    domain: GridDomain,
    input: BallFieldInput,
    marginVoxels = DEFAULT_MARGIN_VOXELS,
  ) {
    const h = domain.spacing;
    const margin = marginVoxels * h;
    const { nx, ny, nz } = domain;
    const [ox, oy, oz] = domain.origin;

    this.floor = -margin;
    const values = new Float64Array(domain.voxelCount).fill(-margin);

    const { x, y, z, count, radii } = input;
    for (let a = 0; a < count; a++) {
      const r = radii[a];
      if (!(r > 0)) continue;
      const reach = r + margin;
      const ax = x[a];
      const ay = y[a];
      const az = z[a];

      const i0 = Math.max(0, Math.ceil((ax - reach - ox) / h));
      const i1 = Math.min(nx - 1, Math.floor((ax + reach - ox) / h));
      if (i0 > i1) continue;
      const j0 = Math.max(0, Math.ceil((ay - reach - oy) / h));
      const j1 = Math.min(ny - 1, Math.floor((ay + reach - oy) / h));
      if (j0 > j1) continue;
      const k0 = Math.max(0, Math.ceil((az - reach - oz) / h));
      const k1 = Math.min(nz - 1, Math.floor((az + reach - oz) / h));
      if (k0 > k1) continue;

      const reach2 = reach * reach;
      for (let i = i0; i <= i1; i++) {
        const dx = ox + i * h - ax;
        const dx2 = dx * dx;
        if (dx2 > reach2) continue;
        for (let j = j0; j <= j1; j++) {
          const dy = oy + j * h - ay;
          const dxy2 = dx2 + dy * dy;
          if (dxy2 > reach2) continue;
          let idx = (i * ny + j) * nz + k0;
          for (let k = k0; k <= k1; k++, idx++) {
            const dz = oz + k * h - az;
            const d2 = dxy2 + dz * dz;
            if (d2 > reach2) continue;
            const v = r - Math.sqrt(d2);
            if (v > values[idx]) values[idx] = v;
          }
        }
      }
    }

    this.values = values;
  }
}
