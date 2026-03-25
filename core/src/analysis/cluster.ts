import {
  Cluster,
  type Frame,
  LinkedCell,
  type ClusterResult as WasmClusterResult,
  Topology as WasmTopology,
} from "@molcrafts/molrs";
import { estimateRMax } from "./utils";

export type ConnectivityMode = "cutoff" | "bonds";

export interface ClusterParams {
  /** Connectivity criterion: "cutoff" (distance-based) or "bonds" (bond topology). Default "cutoff". */
  mode?: ConnectivityMode;
  /** Cutoff distance for neighbor search (only for "cutoff" mode). Auto-detected if not set. */
  rMax?: number;
  /** Minimum number of particles for a valid cluster (default 1). */
  minClusterSize?: number;
  /** Only cluster these atom indices. When set, other atoms get cluster ID -1. */
  selectedIndices?: number[];
  /** Sort cluster IDs by descending size (largest cluster = 0). Default true. */
  sortBySize?: boolean;
  /** Auto-color: if true, writes cluster_id column to the atoms block. */
  colorByCluster?: boolean;
}

export interface ClusterResult {
  /** Per-atom cluster ID. -1 = filtered out (below minClusterSize or not selected). */
  clusterIdx: Int32Array;
  /** Size (particle count) of each valid cluster, sorted by descending size. */
  clusterSizes: Uint32Array;
  /** Number of valid clusters found. */
  numClusters: number;
  /** Total number of atoms in the frame. */
  nParticles: number;
  /** Connectivity mode used. */
  mode: ConnectivityMode;
  /** Cutoff used (only meaningful for "cutoff" mode). */
  rMax: number;
  /** Minimum cluster size used. */
  minClusterSize: number;
}

/**
 * Run cluster analysis on a frame.
 *
 * Two connectivity modes:
 * - "cutoff": build neighbor list via LinkedCell, then BFS on neighbor graph.
 * - "bonds": use existing bond topology (i/j columns in bonds block) as connectivity.
 */
export function computeClusters(
  frame: Frame,
  params: ClusterParams = {},
): ClusterResult | null {
  const atoms = frame.getBlock("atoms");
  if (!atoms || atoms.nrows() < 1) return null;

  const nParticles = atoms.nrows();
  const mode = params.mode ?? "cutoff";
  const minClusterSize = params.minClusterSize ?? 1;
  const sortBySize = params.sortBySize ?? true;

  if (mode === "bonds") {
    return computeClustersByBonds(
      frame,
      nParticles,
      minClusterSize,
      sortBySize,
      params,
    );
  }
  return computeClustersByCutoff(
    frame,
    nParticles,
    minClusterSize,
    sortBySize,
    params,
  );
}

// ---------------------------------------------------------------------------
// Cutoff-distance mode (via WASM LinkedCell + Cluster)
// ---------------------------------------------------------------------------

function computeClustersByCutoff(
  frame: Frame,
  nParticles: number,
  minClusterSize: number,
  sortBySize: boolean,
  params: ClusterParams,
): ClusterResult | null {
  const rMax = params.rMax ?? estimateRMax(frame);
  if (rMax <= 0) return null;

  let lc: LinkedCell | null = null;
  let nlist: ReturnType<LinkedCell["build"]> | null = null;
  let cluster: Cluster | null = null;
  let wasmResult: WasmClusterResult | null = null;

  try {
    lc = new LinkedCell(rMax);
    nlist = lc.build(frame);
    cluster = new Cluster(minClusterSize);
    wasmResult = cluster.compute(frame, nlist);

    let clusterIdx = wasmResult.clusterIdx();
    let clusterSizes = wasmResult.clusterSizes();
    let numClusters = wasmResult.numClusters;

    // Mask out non-selected atoms
    if (params.selectedIndices) {
      ({ clusterIdx, clusterSizes, numClusters } = filterBySelection(
        clusterIdx,
        nParticles,
        params.selectedIndices,
        minClusterSize,
      ));
    }

    if (sortBySize) {
      ({ clusterIdx, clusterSizes, numClusters } = sortClusters(
        clusterIdx,
        clusterSizes,
        numClusters,
      ));
    }

    return {
      clusterIdx,
      clusterSizes,
      numClusters,
      nParticles,
      mode: "cutoff",
      rMax,
      minClusterSize,
    };
  } finally {
    wasmResult?.free();
    cluster?.free();
    nlist?.free();
    lc?.free();
  }
}

// ---------------------------------------------------------------------------
// Bond-topology mode (via WASM Topology.connectedComponents)
// ---------------------------------------------------------------------------

function computeClustersByBonds(
  frame: Frame,
  nParticles: number,
  minClusterSize: number,
  sortBySize: boolean,
  params: ClusterParams,
): ClusterResult | null {
  const bonds = frame.getBlock("bonds");
  if (!bonds || bonds.nrows() === 0) {
    return {
      clusterIdx: new Int32Array(nParticles).fill(-1),
      clusterSizes: new Uint32Array(0),
      numClusters: 0,
      nParticles,
      mode: "bonds",
      rMax: 0,
      minClusterSize,
    };
  }

  let topo: WasmTopology | null = null;
  try {
    topo = WasmTopology.fromFrame(frame);
    const componentLabels = topo.connectedComponents(); // Int32Array

    // Count sizes per component
    const sizeMap = new Map<number, number>();
    for (let i = 0; i < nParticles; i++) {
      const c = componentLabels[i];
      if (c >= 0) sizeMap.set(c, (sizeMap.get(c) ?? 0) + 1);
    }

    // Determine active set
    const selectedSet = params.selectedIndices
      ? new Set(params.selectedIndices)
      : null;

    // Build contiguous cluster IDs, applying minClusterSize + selection filter
    const oldToNew = new Map<number, number>();
    const sizes: number[] = [];

    for (const [oldId, size] of sizeMap) {
      if (size >= minClusterSize) {
        oldToNew.set(oldId, sizes.length);
        sizes.push(size);
      }
    }

    let clusterIdx: Int32Array = new Int32Array(nParticles).fill(-1);
    for (let i = 0; i < nParticles; i++) {
      if (selectedSet && !selectedSet.has(i)) continue;
      const c = componentLabels[i];
      if (c >= 0) {
        clusterIdx[i] = oldToNew.get(c) ?? -1;
      }
    }

    let clusterSizes: Uint32Array = new Uint32Array(sizes);
    let numClusters = sizes.length;

    // Recount if selection filter changed things
    if (selectedSet) {
      ({ clusterIdx, clusterSizes, numClusters } = filterBySelection(
        clusterIdx,
        nParticles,
        params.selectedIndices!,
        minClusterSize,
      ));
    }

    if (sortBySize) {
      ({ clusterIdx, clusterSizes, numClusters } = sortClusters(
        clusterIdx,
        clusterSizes,
        numClusters,
      ));
    }

    return {
      clusterIdx,
      clusterSizes,
      numClusters,
      nParticles,
      mode: "bonds",
      rMax: 0,
      minClusterSize,
    };
  } finally {
    topo?.free();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Re-sort cluster IDs so cluster 0 is the largest. */
function sortClusters(
  clusterIdx: Int32Array,
  clusterSizes: Uint32Array,
  numClusters: number,
): { clusterIdx: Int32Array; clusterSizes: Uint32Array; numClusters: number } {
  // Build sorted order (descending by size)
  const order = Array.from({ length: numClusters }, (_, i) => i);
  order.sort((a, b) => clusterSizes[b] - clusterSizes[a]);

  // Build old→new mapping
  const remap = new Int32Array(numClusters);
  for (let newId = 0; newId < numClusters; newId++) {
    remap[order[newId]] = newId;
  }

  // Remap
  const newIdx = new Int32Array(clusterIdx.length);
  for (let i = 0; i < clusterIdx.length; i++) {
    newIdx[i] = clusterIdx[i] >= 0 ? remap[clusterIdx[i]] : -1;
  }

  const newSizes = new Uint32Array(numClusters);
  for (let newId = 0; newId < numClusters; newId++) {
    newSizes[newId] = clusterSizes[order[newId]];
  }

  return { clusterIdx: newIdx, clusterSizes: newSizes, numClusters };
}

/** Filter cluster results to only include selected atoms; rebuild cluster IDs. */
function filterBySelection(
  clusterIdx: Int32Array,
  nParticles: number,
  selectedIndices: number[],
  minClusterSize: number,
): { clusterIdx: Int32Array; clusterSizes: Uint32Array; numClusters: number } {
  const selected = new Set(selectedIndices);
  const filtered = new Int32Array(nParticles).fill(-1);

  // Copy only selected atoms' assignments
  for (const idx of selectedIndices) {
    if (idx < clusterIdx.length) {
      filtered[idx] = clusterIdx[idx];
    }
  }

  // Recount sizes for the remaining clusters
  const sizeMap = new Map<number, number>();
  for (let i = 0; i < nParticles; i++) {
    const c = filtered[i];
    if (c >= 0) sizeMap.set(c, (sizeMap.get(c) ?? 0) + 1);
  }

  // Remap to contiguous IDs, applying minClusterSize
  const remap = new Map<number, number>();
  const sizes: number[] = [];
  for (const [oldId, size] of sizeMap) {
    if (size >= minClusterSize) {
      remap.set(oldId, sizes.length);
      sizes.push(size);
    }
  }

  const result = new Int32Array(nParticles).fill(-1);
  for (let i = 0; i < nParticles; i++) {
    const c = filtered[i];
    if (c >= 0) {
      result[i] = remap.get(c) ?? -1;
    }
  }

  return {
    clusterIdx: result,
    clusterSizes: new Uint32Array(sizes),
    numClusters: sizes.length,
  };
}
