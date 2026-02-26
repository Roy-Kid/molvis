import type { Frame } from "@molcrafts/molrs";

export interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

/**
 * Calculate bounding box for a frame from its atoms block.
 * Uses x, y, z columns.
 * @param frame The frame to inspect
 * @param padding Optional padding to add to the box
 * @returns BoundingBox or null if no atoms
 */
export function calculateBoundingBox(
  frame: Frame,
  padding = 0.0,
): BoundingBox | null {
  const atoms = frame.getBlock("atoms");
  if (!atoms) return null;

  const x = atoms.getColumnF32("x");
  const y = atoms.getColumnF32("y");
  const z = atoms.getColumnF32("z");

  if (!x || !y || !z || x.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  const count = x.length;
  for (let i = 0; i < count; i++) {
    if (x[i] < minX) minX = x[i];
    if (x[i] > maxX) maxX = x[i];
    if (y[i] < minY) minY = y[i];
    if (y[i] > maxY) maxY = y[i];
    if (z[i] < minZ) minZ = z[i];
    if (z[i] > maxZ) maxZ = z[i];
  }

  if (padding !== 0.0) {
    minX -= padding;
    minY -= padding;
    minZ -= padding;
    maxX += padding;
    maxY += padding;
    maxZ += padding;
  }

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
  };
}
