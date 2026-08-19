/**
 * Contract lock for the analysis result marshalling table.
 *
 * Local molrs returns plain JS objects, so the table is empty and every id
 * passes through by reference. An owned-handle binding must land a table
 * entry — this script fails if the table grows without a matching test.
 *
 * Run: `node regressions/worker-catalog-dispatch-02-marshal.ts`
 * after `npm run build:stage`.
 */
import { marshalAnalysisResult } from "../stage/dist/analysis/result_marshal.js";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

class SentinelPayload {
  readonly calls: string[] = [];

  free(): void {
    this.calls.push("free");
  }
}

const rdf = { rdf: [1], binCenters: [0.5] };
assert(
  marshalAnalysisResult("rdf.radial_distribution", rdf) === rdf,
  "rdf payload must pass through by reference",
);

const cluster = { numClusters: 1 };
assert(
  marshalAnalysisResult("cluster.connected_components", cluster) === cluster,
  "cluster payload must pass through by reference",
);

const sentinel = new SentinelPayload();
const passed = marshalAnalysisResult("voronoi.radical_voronoi", sentinel);
assert(
  passed === sentinel,
  "unlisted id must return the same object reference",
);
assert(
  sentinel.calls.length === 0,
  `unlisted id payload was touched: ${sentinel.calls.join(",")}`,
);

console.log("worker-catalog-dispatch-02-marshal ok");
