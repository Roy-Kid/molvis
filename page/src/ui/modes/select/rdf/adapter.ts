import type {
  RdfComputeAdapter,
  RdfParams,
  RdfResult,
  RdfSelectionSnapshot,
} from "./types";

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error("RDF computation aborted");
    error.name = "AbortError";
    throw error;
  }
}

function estimatePeak(result: RdfResult): { peakR?: number; peakG?: number } {
  let peakIndex = -1;
  let peakValue = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < result.g.length; i++) {
    const r = result.r[i] ?? 0;
    const g = result.g[i] ?? 0;
    if (r < 0.5) {
      continue;
    }
    if (g > peakValue) {
      peakValue = g;
      peakIndex = i;
    }
  }

  if (peakIndex < 0) {
    return {};
  }

  return {
    peakR: result.r[peakIndex],
    peakG: result.g[peakIndex],
  };
}

function buildSyntheticRdf(
  params: RdfParams,
  snapshot: RdfSelectionSnapshot,
): RdfResult {
  const bins = Math.max(
    40,
    Math.floor(params.rMax / Math.max(params.binWidth, 0.01)),
  );
  const r: number[] = [];
  const g: number[] = [];

  const baseDensity = Math.max(0.8, Math.min(1.35, snapshot.atomCount / 200));
  const pairBoost = params.pairType === "AB" ? 0.22 : 0.1;
  const aCode = params.elementA.charCodeAt(0) || 65;
  const bCode = params.elementB?.charCodeAt(0) || aCode;

  // Cosmetic demo values: pseudo-random peak positions derived from element
  // char codes to produce visually distinct but physically meaningless curves.
  const peak1Center = 1.05 + (aCode % 5) * 0.08;
  const peak2Center = 2.15 + (bCode % 7) * 0.05;
  const peak3Center = 3.45 + ((aCode + bCode) % 4) * 0.09;

  for (let i = 0; i < bins; i++) {
    const radius = i * params.binWidth;
    const envelope = 1 - Math.exp(-radius / 1.6);

    const peak1 =
      Math.exp(-((radius - peak1Center) ** 2) / 0.09) * (1.6 + pairBoost);
    const peak2 =
      Math.exp(-((radius - peak2Center) ** 2) / 0.18) *
      (0.95 + pairBoost * 0.8);
    const peak3 =
      Math.exp(-((radius - peak3Center) ** 2) / 0.28) *
      (0.65 + pairBoost * 0.6);

    const raw = (0.72 + peak1 + peak2 + peak3) * envelope * baseDensity;
    const normalized = params.normalize ? raw / baseDensity : raw;

    r.push(radius);
    g.push(Number(normalized.toFixed(4)));
  }

  const result: RdfResult = {
    r,
    g,
    meta: {
      sampleCount: snapshot.atomCount,
    },
  };
  const peak = estimatePeak(result);
  result.meta.peakR = peak.peakR;
  result.meta.peakG = peak.peakG;

  return result;
}

/**
 * Frontend placeholder adapter until WASM RDF is connected.
 */
export const syntheticRdfAdapter: RdfComputeAdapter = {
  async compute(
    params: RdfParams,
    snapshot: RdfSelectionSnapshot,
    signal?: AbortSignal,
  ): Promise<RdfResult> {
    abortIfNeeded(signal);
    await delay(240);
    abortIfNeeded(signal);
    return buildSyntheticRdf(params, snapshot);
  },
};
