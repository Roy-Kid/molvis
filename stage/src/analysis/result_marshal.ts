/**
 * The shape a molrs result takes on its way out of an analysis run.
 *
 * Local molrs returns plain JS objects (no owned result handles). The
 * marshaller table is therefore empty: every id passes through by reference.
 * Kept as the single exit so a future owned-handle binding can land here
 * without touching dispatch.
 */

import { AnalysisUnsupportedError } from "./trajectory_runner";

/** Copy an owned result's columns out, free the handle, return plain data. */
type AnalysisResultMarshaller = (raw: object) => unknown;

/**
 * Per-id result serialization. Empty while molrs results are already plain
 * data. Exported so the unit tests can pin that closed set.
 */
export const ANALYSIS_RESULT_MARSHALLERS: Readonly<
  Record<string, AnalysisResultMarshaller>
> = {};

/**
 * Turn `raw` — whatever the binding for `analysisId` just returned — into a
 * payload that owns no WASM memory.
 *
 * @param analysisId catalog id of the analysis that produced `raw`
 * @param raw the binding's return value
 * @returns `raw` itself by reference for any unlisted id
 * @throws AnalysisUnsupportedError when a listed id's binding returned
 *   something that is not a handle object
 */
export function marshalAnalysisResult(
  analysisId: string,
  raw: unknown,
): unknown {
  if (!Object.hasOwn(ANALYSIS_RESULT_MARSHALLERS, analysisId)) return raw;
  if (typeof raw !== "object" || raw === null) {
    throw new AnalysisUnsupportedError(
      analysisId,
      `its binding returned ${raw === null ? "null" : typeof raw} where a result handle was expected`,
    );
  }
  return ANALYSIS_RESULT_MARSHALLERS[analysisId](raw);
}
