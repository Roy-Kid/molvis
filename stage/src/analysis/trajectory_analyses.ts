import type { Trajectory } from "../system/trajectory";
import { MsdAnalyzer, type MsdResult } from "./msd";
import type { RdfParams, RdfResult } from "./rdf";
import { computeRdf } from "./rdf";
import {
  AnalysisAbortError,
  type AnalysisAtomSelection,
  type AnalysisFrameFailure,
  type AnalysisRunOptions,
  expandFrameRange,
  resolveTrackedAtomIndices,
  resolveTrackedAtomSelection,
  type TrackedAtomSelection,
} from "./trajectory_runner";

export type { AnalysisProgress, AnalysisRunOptions } from "./trajectory_runner";

export interface RdfTrajectoryParams extends RdfParams {
  groupASelection?: AnalysisAtomSelection;
  groupBSelection?: AnalysisAtomSelection;
}

export interface RdfTrajectoryResult {
  average: RdfResult;
  perFrame: Array<{ frameIndex: number; result: RdfResult }>;
  failures: AnalysisFrameFailure[];
  trackedGroupA: TrackedAtomSelection;
  trackedGroupB?: TrackedAtomSelection;
}

export interface MsdTrajectoryParams {
  selection?: AnalysisAtomSelection;
}

export interface MsdTrajectoryResult {
  frameIndices: number[];
  result: MsdResult;
  failures: AnalysisFrameFailure[];
  trackedSelection: TrackedAtomSelection;
}

function fail(
  failures: AnalysisFrameFailure[],
  frameIndex: number,
  error: Error,
  onFrameError?: (failure: AnalysisFrameFailure) => void,
): void {
  const failure = { frameIndex, error };
  failures.push(failure);
  onFrameError?.(failure);
}

function averageRdfResults(
  results: Array<{ frameIndex: number; result: RdfResult }>,
): RdfResult {
  const first = results[0].result;
  const n = results.length;
  const gr = new Float64Array(first.nBins);
  const counts = new Float64Array(first.nBins);
  const density = new Float64Array(first.nBins);
  const y = new Float64Array(first.nBins);
  for (const { result } of results) {
    for (let i = 0; i < first.nBins; i++) {
      gr[i] += result.gr[i];
      counts[i] += result.counts[i];
      density[i] += result.density[i];
      y[i] += result.y[i];
    }
  }
  for (let i = 0; i < first.nBins; i++) {
    gr[i] /= n;
    density[i] /= n;
    y[i] /= n;
    // counts: keep total across frames (trajectory pair occupancy)
  }
  const volumeSum = results.reduce(
    (sum, item) =>
      sum +
      (item.result.hasReferenceVolume && Number.isFinite(item.result.volume)
        ? item.result.volume
        : 0),
    0,
  );
  const volumeCount = results.filter(
    (item) =>
      item.result.hasReferenceVolume && Number.isFinite(item.result.volume),
  ).length;
  return {
    ...first,
    r: new Float64Array(first.r),
    gr,
    counts,
    density,
    y,
    volume: volumeCount > 0 ? volumeSum / volumeCount : Number.NaN,
  };
}

export async function computeRdfTrajectory(
  trajectory: Trajectory,
  params: RdfTrajectoryParams = {},
  run: AnalysisRunOptions = {},
): Promise<RdfTrajectoryResult | null> {
  const frameIndices = expandFrameRange(trajectory.length, run.frameRange);
  if (frameIndices.length === 0) return null;

  const referenceFrameIndex = frameIndices[0];
  const referenceFrame = await trajectory.frame(referenceFrameIndex);
  const trackedGroupA = resolveTrackedAtomSelection(
    referenceFrame,
    params.groupASelection,
    referenceFrameIndex,
  );
  const trackedGroupB = params.groupBSelection
    ? resolveTrackedAtomSelection(
        referenceFrame,
        params.groupBSelection,
        referenceFrameIndex,
      )
    : undefined;

  const perFrame: Array<{ frameIndex: number; result: RdfResult }> = [];
  const failures: AnalysisFrameFailure[] = [];
  const rdfParams: RdfParams = {
    rMax: params.rMax,
    rMin: params.rMin,
    nBins: params.nBins,
    volume: params.volume,
    representation: params.representation,
  };

  for (let ordinal = 0; ordinal < frameIndices.length; ordinal++) {
    if (run.abortSignal?.aborted) throw new AnalysisAbortError();
    const frameIndex = frameIndices[ordinal];
    try {
      const frame = await trajectory.frame(frameIndex);
      const groupA = resolveTrackedAtomIndices(frame, trackedGroupA);
      if (!groupA.ok) {
        throw new Error(
          `Group A tracked atoms are missing in frame ${frameIndex}`,
        );
      }
      const groupB = trackedGroupB
        ? resolveTrackedAtomIndices(frame, trackedGroupB)
        : undefined;
      if (groupB && !groupB.ok) {
        throw new Error(
          `Group B tracked atoms are missing in frame ${frameIndex}`,
        );
      }

      // Both groups "all" → full-frame self-RDF (no sub-frame clone).
      const bothAll =
        trackedGroupA.mode === "all" &&
        (trackedGroupB === undefined || trackedGroupB.mode === "all");
      const result = computeRdf(frame, {
        ...rdfParams,
        groupA: bothAll ? undefined : groupA.indices,
        groupB: bothAll ? undefined : groupB?.indices,
      });
      if (result) perFrame.push({ frameIndex, result });
    } catch (error) {
      fail(
        failures,
        frameIndex,
        error instanceof Error ? error : new Error(String(error)),
        run.onFrameError,
      );
    } finally {
      run.onProgress?.({
        completed: ordinal + 1,
        total: frameIndices.length,
        frameIndex,
      });
    }
  }

  if (perFrame.length === 0) {
    // Prefer the real per-frame failure (box handle / volume / rMax) over a
    // silent null that the UI collapses to "Not enough atoms".
    if (failures.length > 0) throw failures[0].error;
    return null;
  }
  return {
    average: averageRdfResults(perFrame),
    perFrame,
    failures,
    trackedGroupA,
    trackedGroupB,
  };
}

export async function computeMsdTrajectory(
  trajectory: Trajectory,
  params: MsdTrajectoryParams = {},
  run: AnalysisRunOptions = {},
): Promise<MsdTrajectoryResult | null> {
  const frameIndices = expandFrameRange(trajectory.length, run.frameRange);
  if (frameIndices.length < 2) return null;

  const referenceFrameIndex = frameIndices[0];
  const referenceFrame = await trajectory.frame(referenceFrameIndex);
  const trackedSelection = resolveTrackedAtomSelection(
    referenceFrame,
    params.selection,
    referenceFrameIndex,
  );
  const analyzer = new MsdAnalyzer();
  const failures: AnalysisFrameFailure[] = [];
  const fedFrameIndices: number[] = [];

  try {
    for (let ordinal = 0; ordinal < frameIndices.length; ordinal++) {
      if (run.abortSignal?.aborted) throw new AnalysisAbortError();
      const frameIndex = frameIndices[ordinal];
      try {
        const frame = await trajectory.frame(frameIndex);
        const resolved = resolveTrackedAtomIndices(frame, trackedSelection);
        if (!resolved.ok) {
          throw new Error(`Tracked atoms are missing in frame ${frameIndex}`);
        }
        analyzer.feed(
          frame,
          trackedSelection.mode === "all" ? undefined : resolved.indices,
        );
        fedFrameIndices.push(frameIndex);
      } catch (error) {
        fail(
          failures,
          frameIndex,
          error instanceof Error ? error : new Error(String(error)),
          run.onFrameError,
        );
      } finally {
        run.onProgress?.({
          completed: ordinal + 1,
          total: frameIndices.length,
          frameIndex,
        });
      }
    }

    if (fedFrameIndices.length < 2) return null;
    return {
      frameIndices: fedFrameIndices,
      result: analyzer.result(),
      failures,
      trackedSelection,
    };
  } finally {
    analyzer.dispose();
  }
}
