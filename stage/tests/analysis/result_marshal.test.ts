import { describe, expect, it } from "@rstest/core";
import {
  CLUSTER_ANALYSIS_ID,
  COM_ANALYSIS_ID,
  RDF_ANALYSIS_ID,
  VORONOI_RADICAL_ANALYSIS_ID,
} from "../../src/analysis/analysis_ids";
import {
  ANALYSIS_RESULT_MARSHALLERS,
  marshalAnalysisResult,
} from "../../src/analysis/result_marshal";

/**
 * Local molrs returns plain JS objects. The marshaller table is empty —
 * every id passes through by reference. These cases pin that closed set so
 * an owned-handle binding cannot land without a matching table entry.
 */

class SentinelPayload {
  readonly calls: string[] = [];

  free(): void {
    this.calls.push("free");
  }
}

describe("TestResultMarshal", () => {
  it("lists no owned-result ids: molrs results are already plain data", () => {
    expect(Object.keys(ANALYSIS_RESULT_MARSHALLERS)).toEqual([]);
  });

  it("passes rdf / cluster / com payloads through by reference", () => {
    const rdf = { rdf: [1], binCenters: [0.5] };
    const cluster = { numClusters: 1, clusterIdx: new Int32Array([0]) };
    const com = { numClusters: 1, centersOfMass: new Float64Array([0, 0, 0]) };

    expect(marshalAnalysisResult(RDF_ANALYSIS_ID, rdf)).toBe(rdf);
    expect(marshalAnalysisResult(CLUSTER_ANALYSIS_ID, cluster)).toBe(cluster);
    expect(marshalAnalysisResult(COM_ANALYSIS_ID, com)).toBe(com);
  });

  it("passes an unlisted id's payload through by reference, untouched", () => {
    const sentinel = new SentinelPayload();

    const payload = marshalAnalysisResult(
      VORONOI_RADICAL_ANALYSIS_ID,
      sentinel,
    );

    expect(payload).toBe(sentinel);
    expect(sentinel.calls).toEqual([]);
  });
});
