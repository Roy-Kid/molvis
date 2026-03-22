/**
 * Histogram computation for per-atom property distributions.
 * Pure functions — no BabylonJS or WASM dependencies.
 */

export interface HistogramResult {
  /** Bin edges (length = bins + 1) */
  edges: Float64Array;
  /** Bin counts (length = bins) */
  counts: Uint32Array;
  /** Statistics */
  stats: HistogramStats;
}

export interface HistogramStats {
  min: number;
  max: number;
  mean: number;
  std: number;
  count: number;
}

/**
 * Compute a histogram from numeric data.
 *
 * @param data - Input array of values
 * @param bins - Number of bins (default 20)
 * @param range - Optional [min, max] override. If null, auto-detect.
 * @param indices - Optional subset of indices to include (for selection-aware histograms)
 */
export function computeHistogram(
  data: Float32Array,
  bins = 20,
  range?: { min: number; max: number } | null,
  indices?: Set<number> | null,
): HistogramResult {
  const effectiveBins = Math.max(1, Math.round(bins));

  // Collect values (optionally filtered by indices)
  const values: number[] = [];
  if (indices && indices.size > 0) {
    for (const i of indices) {
      if (i >= 0 && i < data.length && Number.isFinite(data[i])) {
        values.push(data[i]);
      }
    }
  } else {
    for (let i = 0; i < data.length; i++) {
      if (Number.isFinite(data[i])) {
        values.push(data[i]);
      }
    }
  }

  const stats = computeStats(values);

  if (values.length === 0) {
    return {
      edges: new Float64Array(effectiveBins + 1),
      counts: new Uint32Array(effectiveBins),
      stats,
    };
  }

  const rMin = range?.min ?? stats.min;
  const rMax = range?.max ?? stats.max;
  const span = rMax - rMin;

  // Build edges
  const edges = new Float64Array(effectiveBins + 1);
  for (let i = 0; i <= effectiveBins; i++) {
    edges[i] = rMin + (i / effectiveBins) * span;
  }

  // Count values into bins
  const counts = new Uint32Array(effectiveBins);
  const invSpan = span > 1e-12 ? effectiveBins / span : 0;

  for (const v of values) {
    let bin = Math.floor((v - rMin) * invSpan);
    // Clamp to [0, bins-1] — last bin is inclusive on right edge
    if (bin < 0) bin = 0;
    if (bin >= effectiveBins) bin = effectiveBins - 1;
    counts[bin]++;
  }

  return { edges, counts, stats };
}

function computeStats(values: number[]): HistogramStats {
  const n = values.length;
  if (n === 0) {
    return { min: 0, max: 0, mean: 0, std: 0, count: 0 };
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;

  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }

  const mean = sum / n;

  let sumSq = 0;
  for (const v of values) {
    const d = v - mean;
    sumSq += d * d;
  }
  const std = Math.sqrt(sumSq / n);

  return { min, max, mean, std, count: n };
}

/**
 * Discover numeric columns suitable for histogramming from an atoms Block.
 */
export function discoverNumericColumns(block: {
  keys(): string[];
  dtype(key: string): string | undefined;
}): { name: string; dtype: string }[] {
  const result: { name: string; dtype: string }[] = [];
  for (const key of block.keys()) {
    if (key.startsWith("__")) continue;
    const dt = block.dtype(key);
    if (!dt) continue;
    if (dt === "string") continue; // skip string columns
    if (dt === "f32" || dt === "u32" || dt === "i32") {
      result.push({ name: key, dtype: dt });
    }
  }
  return result;
}
