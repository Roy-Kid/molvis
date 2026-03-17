export type RdfPairType = "AA" | "AB";

export interface RdfParams {
  pairType: RdfPairType;
  elementA: string;
  elementB?: string;
  rMax: number;
  binWidth: number;
  normalize: boolean;
  usePbc: boolean;
}

export interface RdfResultMeta {
  peakR?: number;
  peakG?: number;
  sampleCount: number;
}

export interface RdfResult {
  r: number[];
  g: number[];
  meta: RdfResultMeta;
}

export interface RdfSelectionSnapshot {
  atomIds: number[];
  atomCount: number;
  elements: string[];
}

export interface RdfComputeAdapter {
  compute(
    params: RdfParams,
    snapshot: RdfSelectionSnapshot,
    signal?: AbortSignal,
  ): Promise<RdfResult>;
}
