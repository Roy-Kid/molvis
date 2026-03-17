/**
 * Catmull-Rom spline interpolation for backbone traces.
 */

export interface SplinePoint {
  x: number;
  y: number;
  z: number;
  /** Tangent direction at this point */
  tx: number;
  ty: number;
  tz: number;
  /** Normal direction (from peptide plane, CA→O direction) */
  nx: number;
  ny: number;
  nz: number;
  /** Interpolated parameter [0, N-1] — integer values correspond to input control points */
  t: number;
}

/**
 * Generate a smooth Catmull-Rom spline through control points.
 *
 * @param positions  - [x, y, z] per control point
 * @param normals    - [nx, ny, nz] per control point (peptide plane normal)
 * @param subdivisions - interpolation points between each pair of control points
 */
export function catmullRomSpline(
  positions: Float64Array,
  normals: Float64Array,
  subdivisions: number,
): SplinePoint[] {
  const n = positions.length / 3;
  if (n < 2) return [];

  const points: SplinePoint[] = [];

  for (let i = 0; i < n - 1; i++) {
    // Four control points: p0, p1, p2, p3 (clamped at boundaries)
    const i0 = Math.max(0, i - 1);
    const i1 = i;
    const i2 = i + 1;
    const i3 = Math.min(n - 1, i + 2);

    for (let s = 0; s < subdivisions; s++) {
      const t = s / subdivisions;
      const tt = t * t;
      const ttt = tt * t;

      // Catmull-Rom basis functions
      const b0 = -0.5 * ttt + tt - 0.5 * t;
      const b1 = 1.5 * ttt - 2.5 * tt + 1.0;
      const b2 = -1.5 * ttt + 2.0 * tt + 0.5 * t;
      const b3 = 0.5 * ttt - 0.5 * tt;

      // Tangent basis functions (derivatives)
      const d0 = -1.5 * tt + 2.0 * t - 0.5;
      const d1 = 4.5 * tt - 5.0 * t;
      const d2 = -4.5 * tt + 4.0 * t + 0.5;
      const d3 = 1.5 * tt - t;

      const px =
        b0 * positions[i0 * 3] +
        b1 * positions[i1 * 3] +
        b2 * positions[i2 * 3] +
        b3 * positions[i3 * 3];
      const py =
        b0 * positions[i0 * 3 + 1] +
        b1 * positions[i1 * 3 + 1] +
        b2 * positions[i2 * 3 + 1] +
        b3 * positions[i3 * 3 + 1];
      const pz =
        b0 * positions[i0 * 3 + 2] +
        b1 * positions[i1 * 3 + 2] +
        b2 * positions[i2 * 3 + 2] +
        b3 * positions[i3 * 3 + 2];

      let tdx =
        d0 * positions[i0 * 3] +
        d1 * positions[i1 * 3] +
        d2 * positions[i2 * 3] +
        d3 * positions[i3 * 3];
      let tdy =
        d0 * positions[i0 * 3 + 1] +
        d1 * positions[i1 * 3 + 1] +
        d2 * positions[i2 * 3 + 1] +
        d3 * positions[i3 * 3 + 1];
      let tdz =
        d0 * positions[i0 * 3 + 2] +
        d1 * positions[i1 * 3 + 2] +
        d2 * positions[i2 * 3 + 2] +
        d3 * positions[i3 * 3 + 2];
      const tLen = Math.sqrt(tdx * tdx + tdy * tdy + tdz * tdz);
      if (tLen > 1e-8) {
        tdx /= tLen;
        tdy /= tLen;
        tdz /= tLen;
      }

      // Interpolate normals (linear + re-orthogonalize against tangent)
      let nx = (1 - t) * normals[i1 * 3] + t * normals[i2 * 3];
      let ny = (1 - t) * normals[i1 * 3 + 1] + t * normals[i2 * 3 + 1];
      let nz = (1 - t) * normals[i1 * 3 + 2] + t * normals[i2 * 3 + 2];

      // Gram-Schmidt: remove tangent component from normal
      const dot = nx * tdx + ny * tdy + nz * tdz;
      nx -= dot * tdx;
      ny -= dot * tdy;
      nz -= dot * tdz;
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nLen > 1e-8) {
        nx /= nLen;
        ny /= nLen;
        nz /= nLen;
      }

      points.push({
        x: px,
        y: py,
        z: pz,
        tx: tdx,
        ty: tdy,
        tz: tdz,
        nx,
        ny,
        nz,
        t: i + t,
      });
    }
  }

  // Add the last control point
  const last = n - 1;
  const prev = n - 2;
  let tdx = positions[last * 3] - positions[prev * 3];
  let tdy = positions[last * 3 + 1] - positions[prev * 3 + 1];
  let tdz = positions[last * 3 + 2] - positions[prev * 3 + 2];
  const tLen = Math.sqrt(tdx * tdx + tdy * tdy + tdz * tdz);
  if (tLen > 1e-8) {
    tdx /= tLen;
    tdy /= tLen;
    tdz /= tLen;
  }

  points.push({
    x: positions[last * 3],
    y: positions[last * 3 + 1],
    z: positions[last * 3 + 2],
    tx: tdx,
    ty: tdy,
    tz: tdz,
    nx: normals[last * 3],
    ny: normals[last * 3 + 1],
    nz: normals[last * 3 + 2],
    t: last,
  });

  return points;
}
