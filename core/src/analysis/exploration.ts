import {
  type Frame,
  WasmKMeans,
  WasmPca2,
  type WasmPcaResult,
} from "@molcrafts/molrs";

/**
 * User-facing configuration for a dataset-exploration run.
 *
 * The shape intentionally mirrors the Plotly-tool UI state one-for-one:
 * every widget in PCATool maps to exactly one field here. Future reducers
 * (`tsne`, `umap`) extend the `reduction` union; `clustering` likewise
 * admits `"none"` to disable colouring-by-cluster without nulling the
 * whole sub-object.
 */
export interface ExplorationConfig {
  /** Names of frame labels to project. Each must exist in `frameLabels`. */
  descriptorNames: string[];
  /** Dimensionality reducer. Only `"pca"` in MVP. */
  reduction: { method: "pca" };
  /**
   * Optional clustering pass run on the 2D embedding for colour purposes.
   *
   * Seed is captured explicitly so reruns are deterministic and shareable.
   */
  clustering:
    | { method: "kmeans"; k: number; seed: number }
    | { method: "none" };
  /** How the Plotly scatter colours individual points. */
  colorBy:
    | { kind: "cluster" }
    | { kind: "label"; name: string }
    | { kind: "frame-index" }
    | { kind: "solid" };
}

/**
 * Result of a completed dataset-exploration run.
 *
 * Stored on `system.exploration` and consumed by `PCATool` to render the
 * Plotly map. `clusters` is `null` iff `config.clustering.method === "none"`.
 */
export interface DatasetExploration {
  config: ExplorationConfig;
  descriptors: {
    /** Mirror of `config.descriptorNames`, order preserved. */
    names: string[];
    /** Row-major `[nFrames * nDescriptors]` stacked matrix fed to the reducer. */
    values: Float64Array;
    nFrames: number;
    nDescriptors: number;
  };
  embedding: {
    /** Row-major `[nFrames * 2]`. `coords[2*i]` is PC1, `coords[2*i+1]` is PC2. */
    coords: Float64Array;
    /** Per-component explained variance, `variance[0] >= variance[1]`. */
    variance: [number, number];
    /** Pre-formatted axis labels, e.g. `["PC1 (42.3%)", "PC2 (18.1%)"]`. */
    axes: [string, string];
  };
  /** Cluster label per frame, or `null` when clustering is disabled. */
  clusters: Int32Array | null;
  /** Wall-clock timestamp from `performance.now()` — for UI "last run" hints. */
  computedAt: number;
}

/**
 * Aggregate per-frame numeric metadata into a column-major label map.
 *
 * Two-pass traversal:
 *
 *   1. Collect the union of `frame.metaNames()` across all frames.
 *   2. For each name, allocate `Float64Array(nFrames)` prefilled with `NaN`
 *      and write `frame.getMetaScalar(name)` when it yields a finite number.
 *      Track per-name whether *any* frame produced a numeric value.
 *
 * Keys that never produced a numeric value in any frame are dropped —
 * they are purely categorical (e.g. `config=trans`). Missing values for
 * otherwise-numeric keys become `NaN`; callers must filter those out
 * before feeding the column into PCA/k-means (see `runExploration`).
 *
 * An empty `frames` array returns an empty `Map`.
 */
export function aggregateFrameLabels(
  frames: Frame[],
): Map<string, Float64Array> {
  const result = new Map<string, Float64Array>();
  const nFrames = frames.length;
  if (nFrames === 0) return result;

  const allNames = new Set<string>();
  for (const frame of frames) {
    const names = frame.metaNames();
    for (const name of names) allNames.add(name);
  }

  for (const name of allNames) {
    const column = new Float64Array(nFrames);
    column.fill(Number.NaN);
    let anyNumeric = false;
    for (let i = 0; i < nFrames; i++) {
      const value = frames[i].getMetaScalar(name);
      if (value !== undefined && Number.isFinite(value)) {
        column[i] = value;
        anyNumeric = true;
      }
    }
    if (anyNumeric) result.set(name, column);
  }

  return result;
}

const DEFAULT_MAX_ITER = 100;

/**
 * Run the configured reducer (and optional clusterer) over the stacked
 * descriptor matrix built from the selected `frameLabels` columns.
 *
 * Synchronous under the hood (the WASM PCA / k-means kernels complete in
 * well under a frame for typical molvis sizes: 10k frames × 20 descriptors
 * ≈ 50 ms), but exposed as `async` so the caller can render a spinner and
 * so future long-running reducers fit without an API break.
 *
 * Throws with a caller-actionable message when:
 *   - `descriptorNames.length < 2`
 *   - any selected name is absent from `frameLabels`
 *   - any selected column contains a non-finite value (the error names
 *     the first offending column so the Compute button can point at it)
 *
 * All `WasmPca2` / `WasmKMeans` / `WasmPcaResult` instances are freed in a
 * `finally` block, so a mid-call throw never leaks WASM memory.
 */
export async function runExploration(
  frameLabels: Map<string, Float64Array>,
  config: ExplorationConfig,
): Promise<DatasetExploration> {
  const names = config.descriptorNames;
  if (names.length < 2) {
    throw new Error(
      `Exploration: descriptorNames must contain at least 2 names, got ${names.length}`,
    );
  }

  const columns: Float64Array[] = [];
  for (const name of names) {
    const column = frameLabels.get(name);
    if (column === undefined) {
      throw new Error(
        `Exploration: descriptor "${name}" is not present in frameLabels`,
      );
    }
    columns.push(column);
  }

  const nFrames = columns[0].length;
  for (let j = 0; j < columns.length; j++) {
    const column = columns[j];
    if (column.length !== nFrames) {
      throw new Error(
        `Exploration: descriptor "${names[j]}" has length ${column.length}, expected ${nFrames}`,
      );
    }
    for (let i = 0; i < nFrames; i++) {
      if (!Number.isFinite(column[i])) {
        throw new Error(
          `Exploration: descriptor "${names[j]}" contains non-finite value at frame index ${i}`,
        );
      }
    }
  }

  const nDescriptors = names.length;
  const values = new Float64Array(nFrames * nDescriptors);
  for (let i = 0; i < nFrames; i++) {
    for (let j = 0; j < nDescriptors; j++) {
      values[i * nDescriptors + j] = columns[j][i];
    }
  }

  let coords: Float64Array;
  let variance: [number, number];

  let pca: WasmPca2 | null = null;
  let pcaResult: WasmPcaResult | null = null;
  try {
    pca = new WasmPca2();
    pcaResult = pca.fitTransform(values, nFrames, nDescriptors);
    coords = pcaResult.coords();
    const varArr = pcaResult.variance();
    variance = [varArr[0], varArr[1]];
  } finally {
    pcaResult?.free();
    pca?.free();
  }

  const axes = formatAxisLabels(variance);

  let clusters: Int32Array | null = null;
  if (config.clustering.method === "kmeans") {
    const { k, seed } = config.clustering;
    let kmeans: WasmKMeans | null = null;
    try {
      kmeans = new WasmKMeans(k, DEFAULT_MAX_ITER, seed);
      clusters = kmeans.fit(coords, nFrames, 2);
    } finally {
      kmeans?.free();
    }
  }

  return {
    config,
    descriptors: {
      names: [...names],
      values,
      nFrames,
      nDescriptors,
    },
    embedding: {
      coords,
      variance,
      axes,
    },
    clusters,
    computedAt: performance.now(),
  };
}

/**
 * Format PCA axis labels as `"PC1 (xx.x%)"` when the variance sum is a
 * positive finite number, otherwise fall back to bare `"PC1"` / `"PC2"`
 * (e.g. when the input was z-scored to zero total variance).
 */
function formatAxisLabels(variance: [number, number]): [string, string] {
  const total = variance[0] + variance[1];
  if (!Number.isFinite(total) || total <= 0) {
    return ["PC1", "PC2"];
  }
  const pct1 = ((variance[0] / total) * 100).toFixed(1);
  const pct2 = ((variance[1] / total) * 100).toFixed(1);
  return [`PC1 (${pct1}%)`, `PC2 (${pct2}%)`];
}
