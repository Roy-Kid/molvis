import assert from "node:assert/strict";
import test from "node:test";
import { syntheticRdfAdapter } from "../src/ui/modes/select/rdf/adapter.ts";
import type {
  RdfParams,
  RdfSelectionSnapshot,
} from "../src/ui/modes/select/rdf/types.ts";

const params: RdfParams = {
  pairType: "AB",
  elementA: "C",
  elementB: "O",
  rMax: 8,
  binWidth: 0.2,
  normalize: true,
  usePbc: true,
};

const snapshot: RdfSelectionSnapshot = {
  atomIds: [1, 2, 3, 4],
  atomCount: 128,
  elements: ["C", "O"],
};

test("syntheticRdfAdapter returns aligned series and metadata", async () => {
  const result = await syntheticRdfAdapter.compute(params, snapshot);

  assert.equal(result.r.length, result.g.length);
  assert.ok(result.r.length >= 40);
  assert.equal(result.meta.sampleCount, snapshot.atomCount);
  assert.equal(typeof result.meta.peakR, "number");
  assert.equal(typeof result.meta.peakG, "number");
  assert.ok((result.meta.peakR ?? 0) >= 0.5);
});

test("syntheticRdfAdapter respects abort signals", async () => {
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    () => syntheticRdfAdapter.compute(params, snapshot, controller.signal),
    (error: unknown) => error instanceof Error && error.name === "AbortError",
  );
});
