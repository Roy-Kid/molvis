/**
 * Generate ribbon mesh geometry from spline points and secondary structure data.
 *
 * Cross-section profiles:
 * - Helix:  wide oval (width=1.6, height=0.4) — like a flattened tube
 * - Sheet:  flat arrow (width=2.0, height=0.15) — thin and wide
 * - Coil:   thin tube (width=0.3, height=0.3) — round thin wire
 */

import type { SecondaryStructureType } from "./pdb_backbone";
import type { SplinePoint } from "./spline";

export interface RibbonMeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  colors: Float32Array;
}

interface CrossSectionProfile {
  width: number;
  height: number;
}

const SS_PROFILES: Record<SecondaryStructureType, CrossSectionProfile> = {
  helix: { width: 1.6, height: 0.4 },
  sheet: { width: 2.0, height: 0.15 },
  coil: { width: 0.3, height: 0.3 },
};

const SS_COLORS: Record<SecondaryStructureType, [number, number, number]> = {
  helix: [0.9, 0.2, 0.3], // red
  sheet: [0.95, 0.85, 0.1], // yellow
  coil: [0.6, 0.6, 0.6], // gray
};

const CROSS_SECTION_SEGMENTS = 8;

/**
 * Build ribbon geometry for one chain.
 *
 * @param splinePoints - Smooth spline points along the backbone
 * @param ssPerPoint   - Secondary structure type per spline point
 */
export function buildRibbonGeometry(
  splinePoints: SplinePoint[],
  ssPerPoint: SecondaryStructureType[],
): RibbonMeshData {
  const nPts = splinePoints.length;
  const nSeg = CROSS_SECTION_SEGMENTS;
  const verticesPerRing = nSeg + 1; // +1 for UV seam closure

  const positions = new Float32Array(nPts * verticesPerRing * 3);
  const normals = new Float32Array(nPts * verticesPerRing * 3);
  const colors = new Float32Array(nPts * verticesPerRing * 4);

  for (let i = 0; i < nPts; i++) {
    const pt = splinePoints[i];
    const ss = ssPerPoint[i];
    const profile = SS_PROFILES[ss];
    const color = SS_COLORS[ss];

    // Binormal = tangent × normal
    const bx = pt.ty * pt.nz - pt.tz * pt.ny;
    const by = pt.tz * pt.nx - pt.tx * pt.nz;
    const bz = pt.tx * pt.ny - pt.ty * pt.nx;

    for (let j = 0; j <= nSeg; j++) {
      const angle = (j / nSeg) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Elliptical cross-section: normal * cos * height/2 + binormal * sin * width/2
      const hw = profile.width * 0.5;
      const hh = profile.height * 0.5;
      const offX = pt.nx * cosA * hh + bx * sinA * hw;
      const offY = pt.ny * cosA * hh + by * sinA * hw;
      const offZ = pt.nz * cosA * hh + bz * sinA * hw;

      const idx = (i * verticesPerRing + j) * 3;
      positions[idx + 0] = pt.x + offX;
      positions[idx + 1] = pt.y + offY;
      positions[idx + 2] = pt.z + offZ;

      // Normal for lighting (points outward from center)
      const nrmLen = Math.sqrt(offX * offX + offY * offY + offZ * offZ);
      const invLen = nrmLen > 1e-8 ? 1 / nrmLen : 0;
      normals[idx + 0] = offX * invLen;
      normals[idx + 1] = offY * invLen;
      normals[idx + 2] = offZ * invLen;

      // Color (RGBA)
      const cIdx = (i * verticesPerRing + j) * 4;
      colors[cIdx + 0] = color[0];
      colors[cIdx + 1] = color[1];
      colors[cIdx + 2] = color[2];
      colors[cIdx + 3] = 1.0;
    }
  }

  // Build triangle strip indices
  const numQuads = (nPts - 1) * nSeg;
  const indices = new Uint32Array(numQuads * 6);
  let idx = 0;

  for (let i = 0; i < nPts - 1; i++) {
    for (let j = 0; j < nSeg; j++) {
      const curr = i * verticesPerRing + j;
      const next = (i + 1) * verticesPerRing + j;

      // Two triangles per quad
      indices[idx++] = curr;
      indices[idx++] = next;
      indices[idx++] = curr + 1;

      indices[idx++] = curr + 1;
      indices[idx++] = next;
      indices[idx++] = next + 1;
    }
  }

  return { positions, normals, indices, colors };
}
