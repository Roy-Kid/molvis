import {
  type Frame,
  Topology as WasmTopology,
  type TopologyRingInfo as WasmTopologyRingInfo,
} from "@molcrafts/molrs";

export interface RingInfo {
  /** Total number of rings detected (SSSR). */
  numRings: number;
  /** Size of each ring (atom count), sorted ascending. */
  ringSizes: Uint32Array;
  /** All rings as arrays of atom indices. */
  rings: number[][];
  /** Per-atom boolean: true if atom is in any ring. */
  atomRingMask: Uint8Array;
}

/**
 * Detect rings in a molecular frame using the SSSR algorithm.
 *
 * Builds a topology graph from the frame's bonds block, then runs
 * Horton-style SSSR detection via WASM.
 *
 * @param frame - Frame with atoms and bonds blocks.
 * @returns Ring information, or null if no bonds are present.
 */
export function detectRings(frame: Frame): RingInfo | null {
  const atoms = frame.getBlock("atoms");
  const bonds = frame.getBlock("bonds");
  if (!atoms || !bonds || bonds.nrows() === 0) return null;

  const nAtoms = atoms.nrows();
  let topo: WasmTopology | null = null;
  let wasmRings: WasmTopologyRingInfo | null = null;

  try {
    topo = WasmTopology.fromFrame(frame);
    wasmRings = topo.findRings();

    const numRings = wasmRings.numRings;
    if (numRings === 0) {
      return {
        numRings: 0,
        ringSizes: new Uint32Array(0),
        rings: [],
        atomRingMask: new Uint8Array(nAtoms),
      };
    }

    const ringSizes = new Uint32Array(wasmRings.ringSizes());
    const atomRingMask = new Uint8Array(wasmRings.atomRingMask(nAtoms));

    // Decode length-prefixed rings data
    const rawRings = wasmRings.rings();
    const rings: number[][] = [];
    let offset = 0;
    while (offset < rawRings.length) {
      const size = rawRings[offset++];
      const ring: number[] = [];
      for (let i = 0; i < size; i++) {
        ring.push(rawRings[offset++]);
      }
      rings.push(ring);
    }

    return { numRings, ringSizes, rings, atomRingMask };
  } finally {
    wasmRings?.free();
    topo?.free();
  }
}

/**
 * Check if a specific atom is in any ring.
 *
 * For repeated queries, prefer `detectRings()` and check `atomRingMask`.
 */
export function isAtomInRing(frame: Frame, atomIdx: number): boolean {
  let topo: WasmTopology | null = null;
  let wasmRings: WasmTopologyRingInfo | null = null;

  try {
    topo = WasmTopology.fromFrame(frame);
    wasmRings = topo.findRings();
    return wasmRings.isAtomInRing(atomIdx);
  } finally {
    wasmRings?.free();
    topo?.free();
  }
}
