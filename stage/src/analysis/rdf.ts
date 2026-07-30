import { type Frame, RDF as WasmRDF } from "@molcrafts/molvis-core/molrs";
import { viewAtomCoords } from "../io/atom_coords";
import { buildAtomSubFrame } from "./frame_subset";
import { estimateRMax } from "./utils";

/**
 * How the radial pair histogram is presented.
 *
 * - `auto` — g(r) when the frame has a box; pair distribution otherwise
 * - `gr` — classic RDF g(r); needs a reference volume (box or explicit)
 * - `pair` — raw pair counts p(r); never needs volume
 * - `density` — shell-normalized pair density ρ(r) = n(r) / (4π r² dr)
 */
export type PairRepresentation = "auto" | "gr" | "pair" | "density";

/** Resolved representation after applying Auto + frame geometry. */
export type ResolvedPairRepresentation = "gr" | "pair" | "density";

/**
 * Where the reference volume for g(r) comes from when the frame has no box.
 * Periodic frames always use the simulation box (readonly).
 */
export type ReferenceVolumeSource = "box" | "manual" | "bbox" | "sphere";

export interface RdfParams {
  /**
   * Maximum distance cutoff. Omit or leave undefined for Auto
   * ({@link estimateRMax}): periodic ≈ 0.45 × min box length; non-periodic
   * ≈ maximum sampled pair distance.
   */
  rMax?: number;
  /**
   * Lower radial cutoff. Defaults to 0 (freud convention). Pairs with
   * `d < rMin` and pairs at exactly `d == 0` are excluded.
   */
  rMin?: number;
  /**
   * Number of bins (default 100). Use {@link estimateNBins} at the call site
   * for Auto ≈ `rMax / 0.02` (panel leaves this empty and resolves it).
   */
  nBins?: number;
  /** Indices of atoms to include (default: all atoms). When only groupA is set, self-histogram. */
  groupA?: number[];
  /** Indices for cross-histogram second group. If omitted, uses groupA. */
  groupB?: number[];
  /**
   * Normalization volume in Å³. Required only for g(r) on non-periodic
   * frames (no box). For periodic frames, overrides the box volume if set.
   * Ignored for `pair` / `density` representations.
   */
  volume?: number;
  /**
   * Presentation mode. Defaults to `auto`.
   */
  representation?: PairRepresentation;
}

export interface RdfResult {
  /** Bin center distances */
  r: Float64Array;
  /**
   * Primary y-series for the resolved representation
   * (g(r), pair counts, or shell density).
   */
  y: Float64Array;
  /** Axis / series label for {@link y}. */
  yLabel: string;
  /** Resolved representation actually computed. */
  representation: ResolvedPairRepresentation;
  /** g(r) values when volume was available; otherwise zeros. */
  gr: Float64Array;
  /** Raw pair counts per bin */
  counts: Float64Array;
  /** Shell density ρ(r) = n(r)/(4π r² dr) */
  density: Float64Array;
  /** Number of bins */
  nBins: number;
  /** Bin width */
  dr: number;
  /** Upper cutoff used */
  rMax: number;
  /** Lower cutoff used */
  rMin: number;
  /** Number of reference particles used */
  nParticles: number;
  /**
   * Normalization volume used for g(r) (Å³). `NaN` when g(r) was not
   * computed (pair / density without a real reference volume).
   */
  volume: number;
  /** True when a real reference volume was used (box or explicit). */
  hasReferenceVolume: boolean;
}

const DEFAULT_N_BINS = 100;
const DEFAULT_R_MIN = 0;
/** Target bin width (Å) when auto-choosing nBins. */
const AUTO_BIN_WIDTH = 0.02;
const AUTO_BINS_MIN = 10;
const AUTO_BINS_MAX = 500;
/**
 * Dummy volume handed to WASM when only pair counts are needed.
 * Normalization of g(r) is discarded in that path.
 */
const DUMMY_VOLUME_FOR_COUNTS = 1;

export function frameHasBox(frame: Frame): boolean {
  return frame.box != null;
}

/**
 * Resolve Auto → concrete representation from frame geometry.
 */
export function resolvePairRepresentation(
  frame: Frame,
  representation: PairRepresentation = "auto",
): ResolvedPairRepresentation {
  if (representation === "auto") {
    return frameHasBox(frame) ? "gr" : "pair";
  }
  return representation;
}

export function representationYLabel(rep: ResolvedPairRepresentation): string {
  switch (rep) {
    case "gr":
      return "g(r)";
    case "pair":
      return "p(r)";
    case "density":
      return "ρ(r)";
  }
}

/**
 * Auto bin count so bin width stays near 0.01–0.05 Å.
 */
export function estimateNBins(rMax: number, rMin = 0): number {
  const span = rMax - rMin;
  if (!(span > 0) || !Number.isFinite(span)) return DEFAULT_N_BINS;
  const n = Math.round(span / AUTO_BIN_WIDTH);
  return Math.max(AUTO_BINS_MIN, Math.min(AUTO_BINS_MAX, n));
}

/**
 * Axis-aligned bounding-box volume of atom coordinates (Å³), or null.
 */
export function estimateBoundingBoxVolume(frame: Frame): number | null {
  const atoms = frame.getBlock("atoms");
  if (!atoms || atoms.nrows() < 1) return null;
  const coords = viewAtomCoords(atoms);
  if (!coords) return null;
  const { x, y, z } = coords;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = y[i];
    const zi = z[i];
    if (xi < minX) minX = xi;
    if (yi < minY) minY = yi;
    if (zi < minZ) minZ = zi;
    if (xi > maxX) maxX = xi;
    if (yi > maxY) maxY = yi;
    if (zi > maxZ) maxZ = zi;
  }
  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;
  // Degenerate (planar / collinear) → null so callers fall back to manual.
  if (!(dx > 0 && dy > 0 && dz > 0)) return null;
  return dx * dy * dz;
}

/**
 * Bounding-sphere volume (sphere through farthest atom from centroid), or null.
 */
export function estimateBoundingSphereVolume(frame: Frame): number | null {
  const atoms = frame.getBlock("atoms");
  if (!atoms || atoms.nrows() < 1) return null;
  const coords = viewAtomCoords(atoms);
  if (!coords) return null;
  const { x, y, z } = coords;
  const n = x.length;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    cx += x[i];
    cy += y[i];
    cz += z[i];
  }
  cx /= n;
  cy /= n;
  cz /= n;
  let maxR2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - cx;
    const dy = y[i] - cy;
    const dz = z[i] - cz;
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 > maxR2) maxR2 = r2;
  }
  if (!(maxR2 > 0)) return null;
  const r = Math.sqrt(maxR2);
  return (4 / 3) * Math.PI * r * r * r;
}

/**
 * Compute a radial pair histogram and present it as g(r), p(r), or ρ(r).
 *
 * **Single path:** molrs `RDF.compute(frame)` streams pairs through a
 * cell-list index (`build_index` + `visit_pairs`) — a full NeighborList is
 * never materialised. Memory is O(N + nBins), not O(P).
 *
 * Group selection:
 * - groupA only → self-histogram within groupA
 * - groupA + groupB → cross-histogram between groupA and groupB
 */
export function computeRdf(
  frame: Frame,
  params: RdfParams = {},
): RdfResult | null {
  const atoms = frame.getBlock("atoms");
  if (!atoms) return null;
  if (atoms.nrows() < 2) return null;

  const representation = resolvePairRepresentation(
    frame,
    params.representation ?? "auto",
  );
  const rMin = params.rMin ?? DEFAULT_R_MIN;
  const rMax = params.rMax ?? estimateRMax(frame);
  if (!(Number.isFinite(rMax) && rMax > rMin && rMax > 0)) {
    throw new Error(
      `Pair distribution: rMax (${rMax}) must be a finite number > rMin (${rMin}) and > 0`,
    );
  }
  if (!(Number.isFinite(rMin) && rMin >= 0)) {
    throw new Error(
      `Pair distribution: rMin (${rMin}) must be a finite number ≥ 0`,
    );
  }

  const nBins = params.nBins ?? DEFAULT_N_BINS;
  if (!(Number.isFinite(nBins) && nBins >= 1)) {
    throw new Error(`Pair distribution: nBins (${nBins}) must be ≥ 1`);
  }

  const needsGr = representation === "gr";
  const volumePlan = resolveVolume(frame, params.volume, needsGr);
  const opts: RdfRunOpts = {
    nBins,
    rMax,
    rMin,
    volumeOverride: volumePlan.wasmVolume,
    hasReferenceVolume: volumePlan.hasReferenceVolume,
    representation,
  };

  const groupA = params.groupA;
  const groupB = params.groupB;
  const hasGroups = groupA && groupA.length > 0;

  try {
    if (!hasGroups) {
      return computeFullRdf(frame, opts);
    }

    const effectiveB = groupB ?? groupA;
    const isSelf =
      groupA === effectiveB ||
      (groupA.length === effectiveB.length &&
        groupA.every((v, i) => v === effectiveB[i]));

    if (isSelf && groupA.length === atoms.nrows()) {
      return computeFullRdf(frame, opts);
    }

    if (isSelf) {
      return computeSelfGroupRdf(frame, groupA, opts);
    }
    return computeCrossGroupRdf(frame, groupA, effectiveB, opts);
  } catch (e) {
    throw rethrowWasm(e, "Pair distribution");
  }
}

/** wasm-bindgen turns Rust panics into RuntimeError: unreachable. */
function rethrowWasm(e: unknown, label: string): Error {
  if (typeof e === "string") return new Error(`${label}: ${e}`);
  if (e instanceof Error) {
    if (e.message === "unreachable" || e.name === "RuntimeError") {
      return new Error(
        `${label}: WASM trap (${e.message}). ` +
          `Common causes: invalid/zero box, missing x/y/z columns, or a freed frame handle.`,
        { cause: e },
      );
    }
    return e;
  }
  return new Error(`${label}: ${String(e)}`);
}

interface VolumePlan {
  /** Value passed to WASM constructor (always a positive number or null=box). */
  wasmVolume: number | null;
  hasReferenceVolume: boolean;
}

function resolveVolume(
  frame: Frame,
  paramVolume: number | undefined,
  needsGr: boolean,
): VolumePlan {
  if (paramVolume !== undefined) {
    if (!Number.isFinite(paramVolume) || paramVolume <= 0) {
      throw new Error(
        `Pair distribution: volume must be a finite positive number, got ${paramVolume}`,
      );
    }
    return { wasmVolume: paramVolume, hasReferenceVolume: true };
  }
  if (frame.box) {
    return { wasmVolume: null, hasReferenceVolume: true };
  }
  if (needsGr) {
    throw new Error(
      "Pair distribution: RDF g(r) needs a reference volume — pass volume (Å³) or choose pair distribution / radial density",
    );
  }
  // Pair / density only need counts; feed a dummy volume to WASM.
  return {
    wasmVolume: DUMMY_VOLUME_FOR_COUNTS,
    hasReferenceVolume: false,
  };
}

interface RdfRunOpts {
  nBins: number;
  rMax: number;
  rMin: number;
  volumeOverride: number | null;
  hasReferenceVolume: boolean;
  representation: ResolvedPairRepresentation;
}

function shellDensity(
  counts: Float64Array,
  r: Float64Array,
  dr: number,
): Float64Array {
  const out = new Float64Array(counts.length);
  for (let i = 0; i < counts.length; i++) {
    const ri = r[i];
    const shell = 4 * Math.PI * ri * ri * dr;
    out[i] = shell > 0 ? counts[i] / shell : 0;
  }
  return out;
}

function pickY(
  rep: ResolvedPairRepresentation,
  gr: Float64Array,
  counts: Float64Array,
  density: Float64Array,
): Float64Array {
  switch (rep) {
    case "gr":
      return gr;
    case "pair":
      return counts;
    case "density":
      return density;
  }
}

/**
 * Run the single molrs RDF API: `new RDF(...).compute(frame)` which streams
 * pairs (no NeighborList). Optional `queryFrame` selects the cross path.
 */
function runWasmRdf(
  frame: Frame,
  opts: RdfRunOpts,
  queryFrame?: Frame,
): RdfResult {
  let rdfObj: WasmRDF | null = null;
  try {
    rdfObj = new WasmRDF(opts.nBins, opts.rMax, opts.rMin, opts.volumeOverride);
    // Streaming API: self = compute(frame); cross = computeCross(ref, query).
    const wasmResult = queryFrame
      ? rdfObj.computeCross(frame, queryFrame)
      : rdfObj.compute(frame);
    const grRaw = new Float64Array(wasmResult.rdf());
    const counts = new Float64Array(wasmResult.pairCounts());
    const nParticles = wasmResult.numPoints;
    const volumeRaw = wasmResult.volume;
    const dr = (opts.rMax - opts.rMin) / opts.nBins;
    const r = new Float64Array(opts.nBins);
    for (let i = 0; i < opts.nBins; i++) {
      r[i] = opts.rMin + (i + 0.5) * dr;
    }
    wasmResult.free();

    const hasReferenceVolume = opts.hasReferenceVolume;
    const gr = hasReferenceVolume ? grRaw : new Float64Array(opts.nBins); // zeros — g(r) not meaningful
    const density = shellDensity(counts, r, dr);
    const representation = opts.representation;
    const y = new Float64Array(pickY(representation, gr, counts, density));

    return {
      r,
      y,
      yLabel: representationYLabel(representation),
      representation,
      gr,
      counts,
      density,
      nBins: opts.nBins,
      dr,
      rMax: opts.rMax,
      rMin: opts.rMin,
      nParticles,
      volume: hasReferenceVolume ? volumeRaw : Number.NaN,
      hasReferenceVolume,
    };
  } finally {
    rdfObj?.free();
  }
}

/** Full-frame self-histogram (streaming cell index). */
function computeFullRdf(frame: Frame, opts: RdfRunOpts): RdfResult {
  return runWasmRdf(frame, opts);
}

/** Self-histogram for a subset of atoms. */
function computeSelfGroupRdf(
  frame: Frame,
  group: number[],
  opts: RdfRunOpts,
): RdfResult | null {
  if (group.length < 2) return null;
  const subFrame = buildAtomSubFrame(frame, group);
  if (!subFrame) return null;
  try {
    return computeFullRdf(subFrame, opts);
  } finally {
    subFrame.free();
  }
}

/** Cross-histogram between two groups (streaming cell index on ref, visit query). */
function computeCrossGroupRdf(
  frame: Frame,
  groupA: number[],
  groupB: number[],
  opts: RdfRunOpts,
): RdfResult | null {
  if (groupA.length < 1 || groupB.length < 1) return null;

  const refFrame = buildAtomSubFrame(frame, groupA);
  const queryFrame = buildAtomSubFrame(frame, groupB);
  if (!refFrame || !queryFrame) {
    refFrame?.free();
    queryFrame?.free();
    return null;
  }

  try {
    return runWasmRdf(refFrame, opts, queryFrame);
  } finally {
    refFrame.free();
    queryFrame.free();
  }
}
