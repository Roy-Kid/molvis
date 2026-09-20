/**
 * Alpha shape of a point set — the classical Edelsbrunner construction.
 *
 * Keep every Delaunay tetrahedron whose circumsphere is smaller than the
 * probe radius α; the boundary of what remains is the surface. Large α
 * approaches the convex hull, small α crumbles the solid away.
 *
 * **Atom centres, not spheres.** Unlike {@link ./hull_surface}, α already
 * plays the role of a probe scale, and this is the definition OVITO's
 * `Construct surface mesh` uses, so a chemist reading "probe sphere radius"
 * gets what they expect. The consequence is that a strictly planar molecule
 * has no tetrahedra at all and is reported degenerate rather than drawn — a
 * radius-aware variant would need a weighted (regular) triangulation, which
 * plain Delaunay cannot give.
 *
 * Smoothing is Taubin's λ/μ pair rather than plain Laplacian. Laplacian
 * smoothing shrinks whatever it touches, and a surface that quietly loses
 * volume as you raise the smoothing level is reporting a smaller molecule
 * than it measured.
 */

import type { SurfaceMesh } from "../surface_mesh";
import { Delaunay3D, type DelaunayPoints } from "./delaunay_3d";

/** Taubin's shrink/unshrink pair; |μ| > λ is what cancels the shrinkage. */
const TAUBIN_LAMBDA = 0.5;
const TAUBIN_MU = -0.53;

export interface AlphaShapeOptions {
  /** Probe sphere radius α, Å. Tetrahedra smaller than this are solid. */
  probeRadius: number;
  /** Smoothing passes over the extracted surface. 0 leaves raw facets. */
  smoothing: number;
}

export class AlphaShape {
  readonly mesh: SurfaceMesh;
  /** True when no tetrahedron survived — flat input, or α below the spacing. */
  readonly degenerate: boolean;
  readonly triangleCount: number;
  /** Tetrahedra kept by the α filter, for diagnostics. */
  readonly solidCount: number;

  constructor(points: DelaunayPoints, options: AlphaShapeOptions) {
    const delaunay = new Delaunay3D(points);
    const alpha = Math.max(0, options.probeRadius);
    const alpha2 = alpha * alpha;
    const solid = delaunay.tetrahedra.filter((t) => t.r2 < alpha2);
    this.solidCount = solid.length;

    const boundary = boundaryFaces(points, solid);
    this.triangleCount = boundary.length;
    this.degenerate = boundary.length === 0;
    this.mesh = this.degenerate
      ? {
          positions: new Float32Array(0),
          indices: new Uint32Array(0),
          normals: new Float32Array(0),
        }
      : buildMesh(points, boundary, Math.max(0, Math.floor(options.smoothing)));
  }
}

/**
 * A face on the surface belongs to one solid tetrahedron; interior faces
 * belong to two. Each surface face is wound so its normal points away from
 * the fourth vertex of the tetrahedron that owns it.
 *
 * That reference is *local* and exact. A centroid-based "outward" test would
 * be wrong in every concave pocket — and pockets are the whole reason to use
 * an alpha shape instead of a convex hull.
 */
function boundaryFaces(
  points: DelaunayPoints,
  solid: ReadonlyArray<{ v: [number, number, number, number] }>,
): Array<[number, number, number]> {
  const counts = new Map<string, number>();
  const byKey = new Map<string, [number, number, number]>();
  const opposite = new Map<string, number>();

  for (const tet of solid) {
    const [a, b, c, d] = tet.v;
    for (const [face, away] of [
      [[a, b, c], d],
      [[a, b, d], c],
      [[a, c, d], b],
      [[b, c, d], a],
    ] as Array<[[number, number, number], number]>) {
      const key = [...face].sort((p, q) => p - q).join(",");
      counts.set(key, (counts.get(key) ?? 0) + 1);
      byKey.set(key, face);
      opposite.set(key, away);
    }
  }

  const out: Array<[number, number, number]> = [];
  for (const [key, count] of counts) {
    if (count !== 1) continue;
    const face = byKey.get(key) as [number, number, number];
    out.push(windAwayFrom(points, face, opposite.get(key) as number));
  }
  return out;
}

/** Swap two corners if the winding's normal points at `away`. */
function windAwayFrom(
  points: DelaunayPoints,
  [a, b, c]: [number, number, number],
  away: number,
): [number, number, number] {
  const ux = points.x[b] - points.x[a];
  const uy = points.y[b] - points.y[a];
  const uz = points.z[b] - points.z[a];
  const vx = points.x[c] - points.x[a];
  const vy = points.y[c] - points.y[a];
  const vz = points.z[c] - points.z[a];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const dx = points.x[away] - points.x[a];
  const dy = points.y[away] - points.y[a];
  const dz = points.z[away] - points.z[a];
  return nx * dx + ny * dy + nz * dz > 0 ? [a, c, b] : [a, b, c];
}

function buildMesh(
  points: DelaunayPoints,
  faces: Array<[number, number, number]>,
  smoothing: number,
): SurfaceMesh {
  const used = [...new Set(faces.flat())];
  const slot = new Map(used.map((index, at) => [index, at]));

  const px = new Float64Array(used.length);
  const py = new Float64Array(used.length);
  const pz = new Float64Array(used.length);
  for (let i = 0; i < used.length; i++) {
    px[i] = points.x[used[i]];
    py[i] = points.y[used[i]];
    pz[i] = points.z[used[i]];
  }

  const tris = faces.map(
    (f) =>
      [
        slot.get(f[0]) as number,
        slot.get(f[1]) as number,
        slot.get(f[2]) as number,
      ] as [number, number, number],
  );

  if (smoothing > 0) taubinSmooth(px, py, pz, tris, smoothing);
  return emit(px, py, pz, tris);
}

function faceNormal(
  px: Float64Array,
  py: Float64Array,
  pz: Float64Array,
  [a, b, c]: readonly [number, number, number],
): [number, number, number] | null {
  const ux = px[b] - px[a];
  const uy = py[b] - py[a];
  const uz = pz[b] - pz[a];
  const vx = px[c] - px[a];
  const vy = py[c] - py[a];
  const vz = pz[c] - pz[a];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz);
  if (!(len > 0)) return null;
  return [nx / len, ny / len, nz / len];
}

/** Alternate a shrinking pass with a slightly larger expanding one. */
function taubinSmooth(
  px: Float64Array,
  py: Float64Array,
  pz: Float64Array,
  tris: ReadonlyArray<readonly [number, number, number]>,
  passes: number,
): void {
  const neighbours: Array<Set<number>> = Array.from(
    { length: px.length },
    () => new Set<number>(),
  );
  for (const [a, b, c] of tris) {
    neighbours[a].add(b).add(c);
    neighbours[b].add(a).add(c);
    neighbours[c].add(a).add(b);
  }

  for (let pass = 0; pass < passes; pass++) {
    relax(px, py, pz, neighbours, TAUBIN_LAMBDA);
    relax(px, py, pz, neighbours, TAUBIN_MU);
  }
}

function relax(
  px: Float64Array,
  py: Float64Array,
  pz: Float64Array,
  neighbours: ReadonlyArray<Set<number>>,
  weight: number,
): void {
  const nx = new Float64Array(px.length);
  const ny = new Float64Array(py.length);
  const nz = new Float64Array(pz.length);

  for (let i = 0; i < px.length; i++) {
    const ring = neighbours[i];
    if (ring.size === 0) {
      nx[i] = px[i];
      ny[i] = py[i];
      nz[i] = pz[i];
      continue;
    }
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const j of ring) {
      sx += px[j];
      sy += py[j];
      sz += pz[j];
    }
    nx[i] = px[i] + weight * (sx / ring.size - px[i]);
    ny[i] = py[i] + weight * (sy / ring.size - py[i]);
    nz[i] = pz[i] + weight * (sz / ring.size - pz[i]);
  }
  px.set(nx);
  py.set(ny);
  pz.set(nz);
}

/** Per-corner vertices carrying area-weighted vertex normals (smooth shading). */
function emit(
  px: Float64Array,
  py: Float64Array,
  pz: Float64Array,
  tris: ReadonlyArray<readonly [number, number, number]>,
): SurfaceMesh {
  const vnx = new Float64Array(px.length);
  const vny = new Float64Array(px.length);
  const vnz = new Float64Array(px.length);
  for (const tri of tris) {
    const n = faceNormal(px, py, pz, tri);
    if (!n) continue;
    for (const v of tri) {
      vnx[v] += n[0];
      vny[v] += n[1];
      vnz[v] += n[2];
    }
  }

  const positions = new Float32Array(tris.length * 9);
  const normals = new Float32Array(tris.length * 9);
  const indices = new Uint32Array(tris.length * 3);
  let at = 0;
  for (const tri of tris) {
    for (const v of tri) {
      positions[at] = px[v];
      positions[at + 1] = py[v];
      positions[at + 2] = pz[v];
      const len = Math.hypot(vnx[v], vny[v], vnz[v]) || 1;
      normals[at] = vnx[v] / len;
      normals[at + 1] = vny[v] / len;
      normals[at + 2] = vnz[v] / len;
      at += 3;
    }
  }
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  return { positions, normals, indices };
}
