/**
 * STL meshes, as the geometry the surface renderer paints.
 *
 * Reading the file is molrs's job (`molrs::io::mesh::stl`, reached through
 * `@molcrafts/molvis-core/molrs`) — the same reader molpack's `StlRegion`
 * uses, so the container a packing run was confined to and the container the
 * viewer draws are read by one implementation, not two. What is left here is
 * the render-side half molrs has no business knowing: expanding a shared
 * vertex table into the flat-shaded corner triples the surface pipeline draws.
 *
 * STL carries no atoms, so it is deliberately **not** a
 * {@link ./formats FileFormat}: no reader turns it into a `Frame` and it never
 * becomes a `DataSource`. It is a static prop the trajectory plays inside, and
 * it enters as view geometry (`pipeline/mesh_overlay.ts`).
 */

import {
  readStlMesh,
  type TriangleMeshData,
} from "@molcrafts/molvis-core/molrs";
import type { SurfaceMesh } from "../algo/surface_mesh";

/** Bytes that molrs could not read as an STL, or an STL with no facets. */
export class StlParseError extends Error {
  constructor(detail: string) {
    super(`STL parse failed: ${detail}`);
    this.name = "StlParseError";
  }
}

/**
 * Triangle soup from `bytes`, one vertex per corner and a flat facet normal
 * on each.
 *
 * Corners are expanded rather than left welded: the surface renderer expands
 * them anyway to give each one a barycentric coordinate
 * (`artist/surface/surface_mesh_renderer.ts`), and sharing them would average
 * the hard edges a CAD mesh is drawn with into a smooth blob.
 *
 * Normals come from molrs, computed from each face's winding — the facet
 * normal recorded in the file is ignored there, because writers (molpack's
 * included) routinely leave it at `0 0 0`.
 */
export function parseStl(bytes: Uint8Array): SurfaceMesh {
  const mesh = read(bytes);
  const faceCount = mesh.faces.length / 3;
  if (faceCount === 0) {
    throw new StlParseError("no triangles");
  }

  const positions = new Float32Array(faceCount * 9);
  const normals = new Float32Array(faceCount * 9);
  const indices = new Uint32Array(faceCount * 3);
  for (let face = 0; face < faceCount; face++) {
    const nx = mesh.faceNormals[face * 3];
    const ny = mesh.faceNormals[face * 3 + 1];
    const nz = mesh.faceNormals[face * 3 + 2];
    for (let corner = 0; corner < 3; corner++) {
      const vertex = mesh.faces[face * 3 + corner] * 3;
      const at = face * 9 + corner * 3;
      positions[at] = mesh.vertices[vertex];
      positions[at + 1] = mesh.vertices[vertex + 1];
      positions[at + 2] = mesh.vertices[vertex + 2];
      normals[at] = nx;
      normals[at + 1] = ny;
      normals[at + 2] = nz;
      indices[face * 3 + corner] = face * 3 + corner;
    }
  }
  return { positions, indices, normals };
}

/** molrs throws a raw wasm string; the ingress wants one error type. */
function read(bytes: Uint8Array): TriangleMeshData {
  try {
    return readStlMesh(bytes);
  } catch (error) {
    throw new StlParseError(
      error instanceof Error ? error.message : String(error),
    );
  }
}
