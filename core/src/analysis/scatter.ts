/**
 * Scatter plot data preparation.
 * Pure functions — no rendering dependencies.
 */

export interface ScatterPoint {
  x: number;
  y: number;
  index: number;
}

export interface ScatterResult {
  points: ScatterPoint[];
  xRange: { min: number; max: number };
  yRange: { min: number; max: number };
  totalCount: number;
  sampledCount: number;
}

/**
 * Prepare scatter plot data from two numeric columns.
 *
 * @param xData - X-axis values
 * @param yData - Y-axis values
 * @param maxPoints - Maximum points to return (downsample if exceeded)
 * @param indices - Optional subset of indices (for selection-aware scatter)
 */
export function prepareScatter(
  xData: Float32Array,
  yData: Float32Array,
  maxPoints = 2000,
  indices?: Set<number> | null,
): ScatterResult {
  // Collect valid points
  const allPoints: ScatterPoint[] = [];
  const count = Math.min(xData.length, yData.length);

  if (indices && indices.size > 0) {
    for (const i of indices) {
      if (i >= 0 && i < count && Number.isFinite(xData[i]) && Number.isFinite(yData[i])) {
        allPoints.push({ x: xData[i], y: yData[i], index: i });
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      if (Number.isFinite(xData[i]) && Number.isFinite(yData[i])) {
        allPoints.push({ x: xData[i], y: yData[i], index: i });
      }
    }
  }

  if (allPoints.length === 0) {
    return {
      points: [],
      xRange: { min: 0, max: 0 },
      yRange: { min: 0, max: 0 },
      totalCount: 0,
      sampledCount: 0,
    };
  }

  // Compute ranges
  const xRange = computeRange(allPoints, (p) => p.x);
  const yRange = computeRange(allPoints, (p) => p.y);

  // Downsample if needed
  const points = allPoints.length > maxPoints
    ? deterministicSample(allPoints, maxPoints)
    : allPoints;

  return {
    points,
    xRange,
    yRange,
    totalCount: allPoints.length,
    sampledCount: points.length,
  };
}

function computeRange(
  points: ScatterPoint[],
  accessor: (p: ScatterPoint) => number,
): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    const v = accessor(p);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

/**
 * Deterministic downsampling via stride-based selection.
 * Preserves distribution better than random sampling.
 */
export function deterministicSample<T>(
  items: T[],
  maxCount: number,
): T[] {
  if (items.length <= maxCount) return items;
  const stride = items.length / maxCount;
  const result: T[] = [];
  for (let i = 0; result.length < maxCount; i++) {
    const idx = Math.floor(i * stride);
    if (idx < items.length) {
      result.push(items[idx]);
    }
  }
  return result;
}
