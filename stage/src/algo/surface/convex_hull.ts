/**
 * Convex hull of a 3-D point set (quickhull).
 *
 * Pure geometry over plain arrays — atoms, radii, and grids are somebody
 * else's problem. See {@link ./hull_surface} for the molecular wrapper.
 *
 * Visible faces are found by scanning the whole face list rather than by
 * walking an adjacency structure. A molecular hull has a few hundred faces
 * and one iteration per hull vertex, so the scan is cheap — and it removes
 * the adjacency bookkeeping that is where quickhull implementations usually
 * go wrong. The horizon falls out of the same scan: a directed edge of a
 * visible face is on the horizon exactly when its reverse is not also owned
 * by a visible face.
 */

import type { MCMesh } from "../marching_cubes";

export interface HullPoints {
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  z: ArrayLike<number>;
  count: number;
}

const EMPTY_MESH: MCMesh = {
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
  normals: new Float32Array(0),
};

interface Face {
  a: number;
  b: number;
  c: number;
  /** Outward unit normal. */
  nx: number;
  ny: number;
  nz: number;
  /** Plane constant: `n · x = offset`. */
  offset: number;
  /** Indices known to lie outside this face. */
  outside: number[];
}

/** Construct from points, then read {@link mesh}. */
export class ConvexHull {
  readonly mesh: MCMesh;
  /**
   * True when the points are collinear, coplanar, or too few for a solid.
   * The hull then has no volume and {@link mesh} is empty.
   */
  readonly degenerate: boolean;
  readonly faceCount: number;

  constructor(points: HullPoints) {
    const faces = buildHull(points);
    this.degenerate = faces === null;
    this.faceCount = faces?.length ?? 0;
    this.mesh = faces ? toMesh(points, faces) : EMPTY_MESH;
  }
}

/** Returns null when no positive-volume hull exists. */
function buildHull(points: HullPoints): Face[] | null {
  const { count } = points;
  if (count < 4) return null;

  const eps = toleranceFor(points);
  const seed = initialSimplex(points, eps);
  if (!seed) return null;

  const [i0, i1, i2, i3] = seed;
  // Any interior point works as the outward reference, and the simplex
  // centroid stays inside the hull for the whole run — so every face can be
  // oriented against it instead of trusting winding to propagate.
  const interior = centroid(points, seed);

  const faces: Face[] = [
    makeFace(points, i0, i1, i2, interior),
    makeFace(points, i0, i1, i3, interior),
    makeFace(points, i0, i2, i3, interior),
    makeFace(points, i1, i2, i3, interior),
  ];

  const onHull = new Set(seed);
  for (let i = 0; i < count; i++) {
    if (onHull.has(i)) continue;
    assign(points, faces, i, eps);
  }

  // One iteration consumes one point permanently, so the bound cannot be hit
  // by a well-behaved run; it exists so a numerical pathology stops instead
  // of spinning.
  const maxIterations = count + 1;
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const pending = faces.find((f) => f.outside.length > 0);
    if (!pending) return faces;

    const apex = furthestOf(points, pending);
    const visible = new Set(
      faces.filter((f) => signedDistance(points, f, apex) > eps),
    );

    const owned = new Set<number>();
    const orphans: number[] = [];
    for (const face of visible) {
      owned.add(edgeKey(face.a, face.b));
      owned.add(edgeKey(face.b, face.c));
      owned.add(edgeKey(face.c, face.a));
      for (const p of face.outside) if (p !== apex) orphans.push(p);
    }

    const horizon: Array<[number, number]> = [];
    for (const face of visible) {
      for (const [from, to] of [
        [face.a, face.b],
        [face.b, face.c],
        [face.c, face.a],
      ] as const) {
        if (!owned.has(edgeKey(to, from))) horizon.push([from, to]);
      }
    }
    if (horizon.length === 0) return faces;

    const kept = faces.filter((f) => !visible.has(f));
    for (const [from, to] of horizon) {
      kept.push(makeFace(points, from, to, apex, interior));
    }
    faces.length = 0;
    faces.push(...kept);

    for (const p of orphans) assign(points, faces, p, eps);
  }
  return faces;
}

/** Scale-aware tolerance: absolute epsilons are meaningless in Å. */
function toleranceFor(points: HullPoints): number {
  let extent = 0;
  for (let i = 0; i < points.count; i++) {
    extent = Math.max(
      extent,
      Math.abs(points.x[i]),
      Math.abs(points.y[i]),
      Math.abs(points.z[i]),
    );
  }
  return Math.max(1e-12, 1e-10 * Math.max(extent, 1));
}

/**
 * Four points spanning a positive volume: the widest pair of axis extremes,
 * the point furthest off that line, then the point furthest off that plane.
 */
function initialSimplex(
  points: HullPoints,
  eps: number,
): [number, number, number, number] | null {
  const { x, y, z, count } = points;
  const extremes: number[] = [];
  for (const axis of [x, y, z]) {
    let lo = 0;
    let hi = 0;
    for (let i = 1; i < count; i++) {
      if (axis[i] < axis[lo]) lo = i;
      if (axis[i] > axis[hi]) hi = i;
    }
    extremes.push(lo, hi);
  }

  let i0 = -1;
  let i1 = -1;
  let best = 0;
  for (let a = 0; a < extremes.length; a++) {
    for (let b = a + 1; b < extremes.length; b++) {
      const d = distanceSq(points, extremes[a], extremes[b]);
      if (d > best) {
        best = d;
        i0 = extremes[a];
        i1 = extremes[b];
      }
    }
  }
  if (i0 < 0 || best <= eps * eps) return null;

  const ax = x[i1] - x[i0];
  const ay = y[i1] - y[i0];
  const az = z[i1] - z[i0];
  let i2 = -1;
  best = 0;
  for (let i = 0; i < count; i++) {
    const bx = x[i] - x[i0];
    const by = y[i] - y[i0];
    const bz = z[i] - z[i0];
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    const d = cx * cx + cy * cy + cz * cz;
    if (d > best) {
      best = d;
      i2 = i;
    }
  }
  if (i2 < 0 || best <= eps * eps) return null;

  const plane = normalOf(points, i0, i1, i2);
  if (!plane) return null;
  let i3 = -1;
  best = 0;
  for (let i = 0; i < count; i++) {
    const d = Math.abs(
      plane.nx * x[i] + plane.ny * y[i] + plane.nz * z[i] - plane.offset,
    );
    if (d > best) {
      best = d;
      i3 = i;
    }
  }
  if (i3 < 0 || best <= eps) return null;

  return [i0, i1, i2, i3];
}

function makeFace(
  points: HullPoints,
  a: number,
  b: number,
  c: number,
  interior: readonly [number, number, number],
): Face {
  const plane = normalOf(points, a, b, c) ?? {
    nx: 0,
    ny: 0,
    nz: 1,
    offset: 0,
  };
  const inward =
    plane.nx * interior[0] +
    plane.ny * interior[1] +
    plane.nz * interior[2] -
    plane.offset;
  // Flip so the normal points away from the interior, and swap two vertices
  // with it so the winding keeps matching the normal.
  if (inward > 0) {
    return {
      a,
      c: b,
      b: c,
      nx: -plane.nx,
      ny: -plane.ny,
      nz: -plane.nz,
      offset: -plane.offset,
      outside: [],
    };
  }
  return { a, b, c, ...plane, outside: [] };
}

function normalOf(
  points: HullPoints,
  a: number,
  b: number,
  c: number,
): { nx: number; ny: number; nz: number; offset: number } | null {
  const { x, y, z } = points;
  const ux = x[b] - x[a];
  const uy = y[b] - y[a];
  const uz = z[b] - z[a];
  const vx = x[c] - x[a];
  const vy = y[c] - y[a];
  const vz = z[c] - z[a];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz);
  if (!(len > 0)) return null;
  nx /= len;
  ny /= len;
  nz /= len;
  return { nx, ny, nz, offset: nx * x[a] + ny * y[a] + nz * z[a] };
}

function signedDistance(points: HullPoints, face: Face, i: number): number {
  return (
    face.nx * points.x[i] +
    face.ny * points.y[i] +
    face.nz * points.z[i] -
    face.offset
  );
}

/** Park `i` on the first face it sits outside of; drop it if there is none. */
function assign(
  points: HullPoints,
  faces: Face[],
  i: number,
  eps: number,
): void {
  for (const face of faces) {
    if (signedDistance(points, face, i) > eps) {
      face.outside.push(i);
      return;
    }
  }
}

function furthestOf(points: HullPoints, face: Face): number {
  let best = face.outside[0];
  let bestDistance = signedDistance(points, face, best);
  for (const i of face.outside) {
    const d = signedDistance(points, face, i);
    if (d > bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

function distanceSq(points: HullPoints, a: number, b: number): number {
  const dx = points.x[a] - points.x[b];
  const dy = points.y[a] - points.y[b];
  const dz = points.z[a] - points.z[b];
  return dx * dx + dy * dy + dz * dz;
}

function centroid(
  points: HullPoints,
  indices: readonly number[],
): [number, number, number] {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const i of indices) {
    cx += points.x[i];
    cy += points.y[i];
    cz += points.z[i];
  }
  const n = indices.length;
  return [cx / n, cy / n, cz / n];
}

/** One vertex per face corner — flat shading, matching marching cubes. */
function toMesh(points: HullPoints, faces: Face[]): MCMesh {
  const positions = new Float32Array(faces.length * 9);
  const normals = new Float32Array(faces.length * 9);
  const indices = new Uint32Array(faces.length * 3);

  let at = 0;
  for (const face of faces) {
    for (const vertex of [face.a, face.b, face.c]) {
      positions[at] = points.x[vertex];
      positions[at + 1] = points.y[vertex];
      positions[at + 2] = points.z[vertex];
      normals[at] = face.nx;
      normals[at + 1] = face.ny;
      normals[at + 2] = face.nz;
      at += 3;
    }
  }
  for (let i = 0; i < indices.length; i++) indices[i] = i;

  return { positions, normals, indices };
}

/** Pack a directed edge into one number so the horizon scan can use a Set. */
function edgeKey(from: number, to: number): number {
  return from * 0x4000000 + to;
}
