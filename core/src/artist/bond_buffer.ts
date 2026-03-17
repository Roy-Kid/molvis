import { Vector3 } from "@babylonjs/core";
import type { Block } from "@molcrafts/molrs";
import { encodePickingColor } from "../picker";

// Module-level scratch vectors — avoids per-call allocation in hot paths.
const TMP_P1 = new Vector3();
const TMP_P2 = new Vector3();
const TMP_CENTER = new Vector3();
const TMP_DIR = new Vector3();

export interface BondBufferOptions {
  radius?: number;
  visible?: (i: number) => boolean;
}

/**
 * Build GPU buffers for all bonds in a frame block.
 * Pure computation — no BabylonJS mesh interaction.
 *
 * @param atomColor - The atom color buffer built by buildAtomBuffers.
 *                    Bond endpoint colors are read directly from this array,
 *                    avoiding the previous redundant copy.
 */
export function buildBondBuffers(
  bondsBlock: Block,
  atomsBlock: Block,
  atomColor: Float32Array,
  bondMeshUniqueId: number,
  options?: BondBufferOptions,
): Map<string, Float32Array> | undefined {
  if (!bondsBlock || bondsBlock.nrows() === 0) return undefined;

  const bondCount = bondsBlock.nrows();
  const iAtoms = bondsBlock.getColumnU32("i");
  const jAtoms = bondsBlock.getColumnU32("j");
  if (!iAtoms || !jAtoms) return undefined;

  const xCoords = atomsBlock.getColumnF32("x");
  const yCoords = atomsBlock.getColumnF32("y");
  const zCoords = atomsBlock.getColumnF32("z");
  if (!xCoords || !yCoords || !zCoords) return undefined;

  const bondMatrix = new Float32Array(bondCount * 16);
  const bondData0 = new Float32Array(bondCount * 4);
  const bondData1 = new Float32Array(bondCount * 4);
  const bondCol0 = new Float32Array(bondCount * 4);
  const bondCol1 = new Float32Array(bondCount * 4);
  const bondSplit = new Float32Array(bondCount * 4);
  const bondPick = new Float32Array(bondCount * 4);

  const bondRadius = options?.radius ?? 0.1;
  const isVisible = options?.visible ?? (() => true);

  for (let b = 0; b < bondCount; b++) {
    const i = iAtoms[b];
    const j = jAtoms[b];
    const visible = isVisible(i) && isVisible(j);

    TMP_P1.set(xCoords[i], yCoords[i], zCoords[i]);
    TMP_P2.set(xCoords[j], yCoords[j], zCoords[j]);

    TMP_CENTER.copyFrom(TMP_P1).addInPlace(TMP_P2).scaleInPlace(0.5);
    TMP_DIR.copyFrom(TMP_P2).subtractInPlace(TMP_P1);
    const dist = TMP_DIR.length();
    if (dist > 1e-8) TMP_DIR.scaleInPlace(1 / dist);
    else TMP_DIR.set(0, 1, 0);

    const scale = dist + bondRadius * 2;
    const matOffset = b * 16;
    const idx4 = b * 4;

    // Matrix
    bondMatrix[matOffset + 0] = scale;
    bondMatrix[matOffset + 5] = scale;
    bondMatrix[matOffset + 10] = scale;
    bondMatrix[matOffset + 15] = 1;
    bondMatrix[matOffset + 12] = TMP_CENTER.x;
    bondMatrix[matOffset + 13] = TMP_CENTER.y;
    bondMatrix[matOffset + 14] = TMP_CENTER.z;

    // Data0 (center, radius)
    bondData0[idx4 + 0] = TMP_CENTER.x;
    bondData0[idx4 + 1] = TMP_CENTER.y;
    bondData0[idx4 + 2] = TMP_CENTER.z;
    bondData0[idx4 + 3] = bondRadius;

    // Data1 (direction, length)
    bondData1[idx4 + 0] = TMP_DIR.x;
    bondData1[idx4 + 1] = TMP_DIR.y;
    bondData1[idx4 + 2] = TMP_DIR.z;
    bondData1[idx4 + 3] = dist;

    // Split
    bondSplit[idx4 + 0] = 0;

    // Colors — read directly from atom color buffer (no copy)
    const alpha = visible ? 1.0 : 0.2;
    const iOff = i * 4;
    const jOff = j * 4;
    bondCol0[idx4 + 0] = atomColor[iOff + 0];
    bondCol0[idx4 + 1] = atomColor[iOff + 1];
    bondCol0[idx4 + 2] = atomColor[iOff + 2];
    bondCol0[idx4 + 3] = atomColor[iOff + 3] * alpha;

    bondCol1[idx4 + 0] = atomColor[jOff + 0];
    bondCol1[idx4 + 1] = atomColor[jOff + 1];
    bondCol1[idx4 + 2] = atomColor[jOff + 2];
    bondCol1[idx4 + 3] = atomColor[jOff + 3] * alpha;

    // Picking
    const p = encodePickingColor(bondMeshUniqueId, b);
    bondPick[idx4 + 0] = p[0];
    bondPick[idx4 + 1] = p[1];
    bondPick[idx4 + 2] = p[2];
    bondPick[idx4 + 3] = p[3];
  }

  const buffers = new Map<string, Float32Array>();
  buffers.set("matrix", bondMatrix);
  buffers.set("instanceData0", bondData0);
  buffers.set("instanceData1", bondData1);
  buffers.set("instanceColor0", bondCol0);
  buffers.set("instanceColor1", bondCol1);
  buffers.set("instanceSplit", bondSplit);
  buffers.set("instancePickingColor", bondPick);
  return buffers;
}

/**
 * In-place refresh of bond positions from updated atom coordinates.
 * Uses module-level scratch vectors to avoid allocation in the hot path.
 */
export function refreshBondPositions(
  bondsBlock: Block,
  x: Float32Array,
  y: Float32Array,
  z: Float32Array,
  bondState: {
    count: number;
    mesh: { thinInstanceBufferUpdated(name: string): void };
    buffers: Map<string, { data: Float32Array }>;
  },
): void {
  const iAtoms = bondsBlock.getColumnU32("i");
  const jAtoms = bondsBlock.getColumnU32("j");
  const matB = bondState.buffers.get("matrix");
  const d0B = bondState.buffers.get("instanceData0");
  const d1B = bondState.buffers.get("instanceData1");

  if (!iAtoms || !jAtoms || !matB || !d0B || !d1B) return;

  const bCount = Math.min(bondsBlock.nrows(), bondState.count);

  for (let b = 0; b < bCount; b++) {
    const i = iAtoms[b];
    const j = jAtoms[b];

    TMP_P1.set(x[i], y[i], z[i]);
    TMP_P2.set(x[j], y[j], z[j]);

    TMP_CENTER.copyFrom(TMP_P1).addInPlace(TMP_P2).scaleInPlace(0.5);
    TMP_DIR.copyFrom(TMP_P2).subtractInPlace(TMP_P1);
    const dist = TMP_DIR.length();
    if (dist > 1e-8) TMP_DIR.scaleInPlace(1 / dist);
    else TMP_DIR.set(0, 1, 0);

    const radius = d0B.data[b * 4 + 3];
    const scale = dist + radius * 2;

    // Matrix
    matB.data[b * 16 + 0] = scale;
    matB.data[b * 16 + 5] = scale;
    matB.data[b * 16 + 10] = scale;
    matB.data[b * 16 + 12] = TMP_CENTER.x;
    matB.data[b * 16 + 13] = TMP_CENTER.y;
    matB.data[b * 16 + 14] = TMP_CENTER.z;

    // Data0
    d0B.data[b * 4 + 0] = TMP_CENTER.x;
    d0B.data[b * 4 + 1] = TMP_CENTER.y;
    d0B.data[b * 4 + 2] = TMP_CENTER.z;

    // Data1
    d1B.data[b * 4 + 0] = TMP_DIR.x;
    d1B.data[b * 4 + 1] = TMP_DIR.y;
    d1B.data[b * 4 + 2] = TMP_DIR.z;
    d1B.data[b * 4 + 3] = dist;
  }

  bondState.mesh.thinInstanceBufferUpdated("matrix");
  bondState.mesh.thinInstanceBufferUpdated("instanceData0");
  bondState.mesh.thinInstanceBufferUpdated("instanceData1");
}
