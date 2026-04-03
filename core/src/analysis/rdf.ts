import {
  Block,
  type Frame,
  Frame as FrameClass,
  LinkedCell,
  RDF as WasmRDF,
} from "@molcrafts/molrs";
import { estimateRMax } from "./utils";

export interface RdfParams {
  /** Maximum distance cutoff. Auto-detected from box or bounding box if not set. */
  rMax?: number;
  /** Number of bins (default 100) */
  nBins?: number;
  /** Indices of atoms to include (default: all atoms). When only groupA is set, computes self-RDF. */
  groupA?: number[];
  /** Indices for cross-RDF second group. If omitted, uses groupA (self-RDF). */
  groupB?: number[];
}

export interface RdfResult {
  /** Bin center distances */
  r: Float32Array;
  /** g(r) values */
  gr: Float32Array;
  /** Raw pair counts per bin */
  counts: Float32Array;
  /** Number of bins */
  nBins: number;
  /** Bin width */
  dr: number;
  /** Cutoff used */
  rMax: number;
  /** Number of particles used */
  nParticles: number;
  /** Box volume (Å³). Uses bounding box for non-periodic systems. */
  volume: number;
}

/**
 * Compute the radial distribution function g(r) from a single frame.
 *
 * Uses WASM LinkedCell (cell-list neighbor search) for all systems:
 * - Periodic (simbox present): uses periodic boundary conditions.
 * - Non-periodic (no simbox): auto-generates bounding box from coordinates.
 *
 * Group selection:
 * - groupA only → self-RDF within groupA
 * - groupA + groupB → cross-RDF between groupA and groupB
 */
export function computeRdf(
  frame: Frame,
  params: RdfParams = {},
): RdfResult | null {
  const atoms = frame.getBlock("atoms");
  if (!atoms) return null;
  if (atoms.nrows() < 2) return null;

  const nBins = params.nBins ?? 100;
  const rMax = params.rMax ?? estimateRMax(frame);
  if (rMax <= 0) return null;

  const groupA = params.groupA;
  const groupB = params.groupB;
  const hasGroups = groupA && groupA.length > 0;

  if (!hasGroups) {
    return computeFullRdf(frame, nBins, rMax);
  }

  const effectiveB = groupB ?? groupA;
  const isSelf =
    groupA === effectiveB ||
    (groupA.length === effectiveB.length &&
      groupA.every((v, i) => v === effectiveB[i]));

  if (isSelf) {
    return computeSelfGroupRdf(frame, groupA, nBins, rMax);
  }
  return computeCrossGroupRdf(frame, groupA, effectiveB, nBins, rMax);
}

/** Full-frame RDF via LinkedCell.build (self-query, unique pairs). */
function computeFullRdf(
  frame: Frame,
  nBins: number,
  rMax: number,
): RdfResult | null {
  let lc: LinkedCell | null = null;
  let nlist: ReturnType<LinkedCell["build"]> | null = null;
  let rdfObj: WasmRDF | null = null;

  try {
    lc = new LinkedCell(rMax);
    nlist = lc.build(frame);
    rdfObj = new WasmRDF(nBins, rMax);
    return extractResult(rdfObj.compute(frame, nlist), nBins, rMax);
  } finally {
    lc?.free();
    nlist?.free();
    rdfObj?.free();
  }
}

/** Self-RDF for a subset of atoms. */
function computeSelfGroupRdf(
  frame: Frame,
  group: number[],
  nBins: number,
  rMax: number,
): RdfResult | null {
  if (group.length < 2) return null;
  const subFrame = buildSubFrame(frame, group);
  if (!subFrame) return null;

  try {
    return computeFullRdf(subFrame, nBins, rMax);
  } finally {
    subFrame.free();
  }
}

/** Cross-RDF between two groups via LinkedCell.query. */
function computeCrossGroupRdf(
  frame: Frame,
  groupA: number[],
  groupB: number[],
  nBins: number,
  rMax: number,
): RdfResult | null {
  if (groupA.length < 1 || groupB.length < 1) return null;

  const refFrame = buildSubFrame(frame, groupA);
  const queryFrame = buildSubFrame(frame, groupB);
  if (!refFrame || !queryFrame) {
    refFrame?.free();
    queryFrame?.free();
    return null;
  }

  let lc: LinkedCell | null = null;
  let nlist: ReturnType<LinkedCell["query"]> | null = null;
  let rdfObj: WasmRDF | null = null;

  try {
    lc = new LinkedCell(rMax);
    nlist = lc.query(refFrame, queryFrame);
    rdfObj = new WasmRDF(nBins, rMax);
    return extractResult(rdfObj.compute(refFrame, nlist), nBins, rMax);
  } finally {
    lc?.free();
    nlist?.free();
    rdfObj?.free();
    refFrame.free();
    queryFrame.free();
  }
}

/** Extract RdfResult from WASM RdfOutput, then free it. */
function extractResult(
  wasmResult: ReturnType<WasmRDF["compute"]>,
  nBins: number,
  rMax: number,
): RdfResult {
  const r = wasmResult.binCenters();
  const gr = wasmResult.rdf();
  const counts = wasmResult.pairCounts();
  const nParticles = wasmResult.numPoints;
  const volume = wasmResult.volume;
  const dr = rMax / nBins;

  wasmResult.free();
  return { r, gr, counts, nBins, dr, rMax, nParticles, volume };
}

/**
 * Build a sub-frame containing only the selected atom indices.
 * Copies simbox from the original frame if present.
 */
function buildSubFrame(frame: Frame, indices: number[]): Frame | null {
  const atoms = frame.getBlock("atoms");
  if (!atoms) return null;

  const x = atoms.copyColF("x");
  const y = atoms.copyColF("y");
  const z = atoms.copyColF("z");
  if (!x || !y || !z) return null;

  const n = indices.length;
  const sx = new Float32Array(n);
  const sy = new Float32Array(n);
  const sz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    sx[i] = x[indices[i]];
    sy[i] = y[indices[i]];
    sz[i] = z[indices[i]];
  }

  const subBlock = new Block();
  subBlock.setColF("x", sx);
  subBlock.setColF("y", sy);
  subBlock.setColF("z", sz);

  const elems = atoms.copyColStr("element");
  if (elems) {
    subBlock.setColStr(
      "element",
      indices.map((i) => elems[i]),
    );
  }

  const subFrame = new FrameClass();
  subFrame.insertBlock("atoms", subBlock);

  // Copy simbox so LinkedCell uses periodic boundaries for periodic systems.
  // For non-periodic frames (no simbox), LinkedCell auto-generates a bounding box.
  const simbox = frame.simbox;
  if (simbox) {
    subFrame.simbox = simbox;
  }

  return subFrame;
}
