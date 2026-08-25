/**
 * Delaunay tetrahedralisation of a 3-D point set (incremental Bowyer–Watson).
 *
 * Pure geometry over plain arrays. Built for {@link ./alpha_shape}, which
 * needs the tetrahedra and their circumradii.
 *
 * Two things keep this tractable:
 *
 * 1. **Cavity boundary without global adjacency.** The faces of the bad-tet
 *    cavity are exactly the faces owned by one bad tet, which falls out of
 *    counting the bad set's own faces — the same trick the convex hull uses
 *    for its horizon.
 * 2. **Locating the bad set.** Points are inserted in Morton order and the
 *    tetrahedra created by the previous insertion are tried as the seed, so
 *    the flood fill starts next door. A face map gives the flood fill its
 *    neighbours. When the hint misses, the fallback is a full scan — correct
 *    but linear, so {@link Delaunay3D.seedMisses} reports how often it
 *    happened rather than letting a silent quadratic blow-up hide.
 *
 * Degeneracy is the real hazard here: a perfect crystal is wall-to-wall
 * cospherical and coplanar points, exactly what a naive predicate mishandles.
 * Tolerances are therefore relative to the point-set extent, never absolute.
 */

export interface DelaunayPoints {
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  z: ArrayLike<number>;
  count: number;
}

export interface Tetrahedron {
  /** Point indices into the input arrays. */
  v: [number, number, number, number];
  /** Circumcentre. */
  cx: number;
  cy: number;
  cz: number;
  /** Squared circumradius — the alpha filter's input. */
  r2: number;
}

/**
 * Face keys pack three vertex indices into one number, which caps the point
 * count at 2^17. Alpha shape guards well below this on cost grounds anyway.
 */
export const MAX_DELAUNAY_POINTS = 131_072;

interface Cell extends Tetrahedron {
  dead: boolean;
}

export class Delaunay3D {
  readonly tetrahedra: Tetrahedron[];
  /** True when the points cannot span a volume, so there is nothing to build. */
  readonly degenerate: boolean;
  /** Insertions that fell back to a full scan. Large values mean slow. */
  readonly seedMisses: number;
  /** Coincident points skipped — see {@link triangulate}. */
  readonly duplicatesDropped: number;

  constructor(points: DelaunayPoints) {
    if (points.count < 4 || points.count > MAX_DELAUNAY_POINTS) {
      this.tetrahedra = [];
      this.degenerate = true;
      this.seedMisses = 0;
      this.duplicatesDropped = 0;
      return;
    }
    const result = triangulate(points);
    this.tetrahedra = result.tetrahedra;
    this.degenerate = result.tetrahedra.length === 0;
    this.seedMisses = result.seedMisses;
    this.duplicatesDropped = result.duplicatesDropped;
  }
}

function triangulate(points: DelaunayPoints): {
  tetrahedra: Tetrahedron[];
  seedMisses: number;
  duplicatesDropped: number;
} {
  const n = points.count;
  const bounds = boundsOf(points);
  if (!(bounds.radius > 0))
    return { tetrahedra: [], seedMisses: 0, duplicatesDropped: 0 };

  // Extended coordinates: the real points, then four super-tetrahedron
  // corners that are stripped again at the end.
  const x = new Float64Array(n + 4);
  const y = new Float64Array(n + 4);
  const z = new Float64Array(n + 4);
  for (let i = 0; i < n; i++) {
    x[i] = points.x[i];
    y[i] = points.y[i];
    z[i] = points.z[i];
  }
  writeSuperTetrahedron(x, y, z, n, bounds);
  const all: DelaunayPoints = { x, y, z, count: n + 4 };

  const eps = 1e-9 * bounds.radius * bounds.radius;
  const cells: Cell[] = [];
  const seed = makeCell(all, n, n + 1, n + 2, n + 3);
  if (!seed) return { tetrahedra: [], seedMisses: 0, duplicatesDropped: 0 };
  cells.push(seed);

  /** faceKey → indices of live cells owning that face (at most two). */
  const faces = new Map<number, number[]>();
  addFaces(faces, cells, 0);

  let recent = [0];
  let seedMisses = 0;

  // Coincident points are not distinct Delaunay vertices, and feeding them in
  // does not merely waste work: near-coincident pairs spawn slivers with huge
  // circumradii that cascade into a structurally broken triangulation. Real
  // files supply them — PDB altloc conformers, duplicated records — so they
  // are dropped up front rather than trusted to cancel out.
  const seen = new Set<string>();
  const snap = Math.max(1e-9, 1e-7 * bounds.radius);
  let duplicatesDropped = 0;

  for (const p of mortonOrder(points, bounds)) {
    const key = `${Math.round(x[p] / snap)},${Math.round(y[p] / snap)},${Math.round(z[p] / snap)}`;
    if (seen.has(key)) {
      duplicatesDropped++;
      continue;
    }
    seen.add(key);

    const start = findBadSeed(all, cells, recent, p, eps);
    if (start < 0) {
      seedMisses++;
      continue;
    }
    const bad = floodBad(all, cells, faces, start, p, eps);
    const cavity = cavityFaces(cells, bad);
    if (cavity.length === 0) continue;

    for (const index of bad) {
      removeFaces(faces, cells, index);
      cells[index].dead = true;
    }

    recent = [];
    for (const face of cavity) {
      const cell = makeCell(all, face[0], face[1], face[2], p);
      if (!cell) continue;
      const index = cells.push(cell) - 1;
      addFaces(faces, cells, index);
      recent.push(index);
    }
    if (recent.length === 0) recent = [...bad];
  }

  // Anything still touching a super-tetrahedron corner is an artefact of the
  // scaffold, not a tetrahedron of the real point set.
  const tetrahedra: Tetrahedron[] = [];
  for (const cell of cells) {
    if (cell.dead) continue;
    if (cell.v.some((v) => v >= n)) continue;
    tetrahedra.push({
      v: cell.v,
      cx: cell.cx,
      cy: cell.cy,
      cz: cell.cz,
      r2: cell.r2,
    });
  }
  return { tetrahedra, seedMisses, duplicatesDropped };
}

/** `findBadSeed` returns -1 only when no cell's circumsphere covers `p`. */
function findBadSeed(
  points: DelaunayPoints,
  cells: Cell[],
  recent: readonly number[],
  p: number,
  eps: number,
): number {
  for (const index of recent) {
    if (!cells[index].dead && contains(cells[index], points, p, eps)) {
      return index;
    }
  }
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i].dead && contains(cells[i], points, p, eps)) return i;
  }
  return -1;
}

/** Bad cells form a connected region around `p`; walk it through shared faces. */
function floodBad(
  points: DelaunayPoints,
  cells: Cell[],
  faces: Map<number, number[]>,
  start: number,
  p: number,
  eps: number,
): number[] {
  const bad: number[] = [start];
  const seen = new Set<number>([start]);
  const queue: number[] = [start];

  while (queue.length > 0) {
    const index = queue.pop() as number;
    for (const key of faceKeysOf(cells[index])) {
      for (const neighbour of faces.get(key) ?? []) {
        if (seen.has(neighbour) || cells[neighbour].dead) continue;
        if (!contains(cells[neighbour], points, p, eps)) continue;
        seen.add(neighbour);
        bad.push(neighbour);
        queue.push(neighbour);
      }
    }
  }
  return bad;
}

/** Faces owned by exactly one bad cell bound the cavity. */
function cavityFaces(
  cells: Cell[],
  bad: readonly number[],
): Array<[number, number, number]> {
  const counts = new Map<number, number>();
  const byKey = new Map<number, [number, number, number]>();
  for (const index of bad) {
    for (const face of facesOf(cells[index])) {
      const key = faceKey(face[0], face[1], face[2]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      byKey.set(key, face);
    }
  }
  const out: Array<[number, number, number]> = [];
  for (const [key, count] of counts) {
    if (count === 1) out.push(byKey.get(key) as [number, number, number]);
  }
  return out;
}

function contains(
  cell: Cell,
  points: DelaunayPoints,
  p: number,
  eps: number,
): boolean {
  const dx = points.x[p] - cell.cx;
  const dy = points.y[p] - cell.cy;
  const dz = points.z[p] - cell.cz;
  return dx * dx + dy * dy + dz * dz < cell.r2 - eps;
}

function makeCell(
  points: DelaunayPoints,
  a: number,
  b: number,
  c: number,
  d: number,
): Cell | null {
  const sphere = circumsphere(points, a, b, c, d);
  if (!sphere) return null;
  return { v: [a, b, c, d], ...sphere, dead: false };
}

/**
 * Circumcentre solves `2(b−a)·X = |b|²−|a|²` and its two siblings.
 * Returns null for a flat (coplanar) tetrahedron.
 */
function circumsphere(
  points: DelaunayPoints,
  a: number,
  b: number,
  c: number,
  d: number,
): { cx: number; cy: number; cz: number; r2: number } | null {
  const { x, y, z } = points;
  const ax = x[a];
  const ay = y[a];
  const az = z[a];

  const bx = x[b] - ax;
  const by = y[b] - ay;
  const bz = z[b] - az;
  const cx = x[c] - ax;
  const cy = y[c] - ay;
  const cz = z[c] - az;
  const dx = x[d] - ax;
  const dy = y[d] - ay;
  const dz = z[d] - az;

  const det =
    bx * (cy * dz - cz * dy) -
    by * (cx * dz - cz * dx) +
    bz * (cx * dy - cy * dx);
  const scale = Math.max(
    Math.abs(bx) + Math.abs(by) + Math.abs(bz),
    Math.abs(cx) + Math.abs(cy) + Math.abs(cz),
    Math.abs(dx) + Math.abs(dy) + Math.abs(dz),
  );
  if (Math.abs(det) < 1e-12 * scale * scale * scale) return null;

  const bl = bx * bx + by * by + bz * bz;
  const cl = cx * cx + cy * cy + cz * cz;
  const dl = dx * dx + dy * dy + dz * dz;

  const ox =
    (bl * (cy * dz - cz * dy) -
      cl * (by * dz - bz * dy) +
      dl * (by * cz - bz * cy)) /
    (2 * det);
  const oy =
    (-bl * (cx * dz - cz * dx) +
      cl * (bx * dz - bz * dx) -
      dl * (bx * cz - bz * cx)) /
    (2 * det);
  const oz =
    (bl * (cx * dy - cy * dx) -
      cl * (bx * dy - by * dx) +
      dl * (bx * cy - by * cx)) /
    (2 * det);

  return {
    cx: ax + ox,
    cy: ay + oy,
    cz: az + oz,
    r2: ox * ox + oy * oy + oz * oz,
  };
}

function facesOf(cell: Cell): Array<[number, number, number]> {
  const [a, b, c, d] = cell.v;
  return [
    [a, b, c],
    [a, b, d],
    [a, c, d],
    [b, c, d],
  ];
}

function faceKeysOf(cell: Cell): number[] {
  return facesOf(cell).map((f) => faceKey(f[0], f[1], f[2]));
}

/** Order-independent key: sort the three indices, then pack them. */
function faceKey(a: number, b: number, c: number): number {
  let lo = a;
  let mid = b;
  let hi = c;
  if (lo > mid) [lo, mid] = [mid, lo];
  if (mid > hi) [mid, hi] = [hi, mid];
  if (lo > mid) [lo, mid] = [mid, lo];
  return (lo * MAX_DELAUNAY_POINTS + mid) * MAX_DELAUNAY_POINTS + hi;
}

function addFaces(
  faces: Map<number, number[]>,
  cells: Cell[],
  index: number,
): void {
  for (const key of faceKeysOf(cells[index])) {
    const owners = faces.get(key);
    if (owners) owners.push(index);
    else faces.set(key, [index]);
  }
}

function removeFaces(
  faces: Map<number, number[]>,
  cells: Cell[],
  index: number,
): void {
  for (const key of faceKeysOf(cells[index])) {
    const owners = faces.get(key);
    if (!owners) continue;
    const at = owners.indexOf(index);
    if (at >= 0) owners.splice(at, 1);
    if (owners.length === 0) faces.delete(key);
  }
}

interface Bounds {
  cx: number;
  cy: number;
  cz: number;
  radius: number;
}

function boundsOf(points: DelaunayPoints): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < points.count; i++) {
    minX = Math.min(minX, points.x[i]);
    minY = Math.min(minY, points.y[i]);
    minZ = Math.min(minZ, points.z[i]);
    maxX = Math.max(maxX, points.x[i]);
    maxY = Math.max(maxY, points.y[i]);
    maxZ = Math.max(maxZ, points.z[i]);
  }
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    cz: (minZ + maxZ) / 2,
    radius: 0.5 * Math.hypot(maxX - minX, maxY - minY, maxZ - minZ),
  };
}

/**
 * A regular tetrahedron whose inscribed sphere (radius `R_t/3`) comfortably
 * contains every point, so no real point can fall outside the scaffold.
 */
function writeSuperTetrahedron(
  x: Float64Array,
  y: Float64Array,
  z: Float64Array,
  at: number,
  bounds: Bounds,
): void {
  const scale = (10 * bounds.radius) / Math.sqrt(3);
  const corners = [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ] as const;
  for (let i = 0; i < 4; i++) {
    x[at + i] = bounds.cx + corners[i][0] * scale;
    y[at + i] = bounds.cy + corners[i][1] * scale;
    z[at + i] = bounds.cz + corners[i][2] * scale;
  }
}

/**
 * Insertion order matters: spatially coherent points keep the previous
 * insertion's tetrahedra near the next one, which is what makes the seed
 * hint hit instead of falling back to a full scan.
 */
function mortonOrder(points: DelaunayPoints, bounds: Bounds): number[] {
  const order = Array.from({ length: points.count }, (_, i) => i);
  const span = 2 * bounds.radius || 1;
  const key = (i: number) =>
    morton(
      Math.floor((1023 * (points.x[i] - bounds.cx + bounds.radius)) / span),
      Math.floor((1023 * (points.y[i] - bounds.cy + bounds.radius)) / span),
      Math.floor((1023 * (points.z[i] - bounds.cz + bounds.radius)) / span),
    );
  const keys = order.map(key);
  order.sort((a, b) => keys[a] - keys[b]);
  return order;
}

function morton(ix: number, iy: number, iz: number): number {
  return (
    spread(clamp10(ix)) |
    (spread(clamp10(iy)) << 1) |
    (spread(clamp10(iz)) << 2)
  );
}

function clamp10(v: number): number {
  return Math.max(0, Math.min(1023, v));
}

/** Interleave a 10-bit value with two zero bits between each source bit. */
function spread(v: number): number {
  let n = v & 0x3ff;
  n = (n | (n << 16)) & 0x030000ff;
  n = (n | (n << 8)) & 0x0300f00f;
  n = (n | (n << 4)) & 0x030c30c3;
  n = (n | (n << 2)) & 0x09249249;
  return n;
}
