import { describe, expect, it } from "@rstest/core";
import {
  isWorkloadResponse,
  type WorkloadRequest,
  type WorkloadResponse,
} from "../src/workload/protocol";

describe("isWorkloadResponse", () => {
  it("accepts the host-call variant", () => {
    expect(isWorkloadResponse({ type: "host-call", callId: 1, call: {} })).toBe(
      true,
    );
  });

  it("accepts the pre-existing envelope tags", () => {
    expect(isWorkloadResponse({ type: "ready" })).toBe(true);
    expect(isWorkloadResponse({ type: "progress", id: 1, progress: 0 })).toBe(
      true,
    );
    expect(isWorkloadResponse({ type: "done", id: 1, result: null })).toBe(
      true,
    );
    expect(isWorkloadResponse({ type: "error", id: 1, message: "x" })).toBe(
      true,
    );
  });

  it("rejects null and non-objects", () => {
    expect(isWorkloadResponse(null)).toBe(false);
    expect(isWorkloadResponse(undefined)).toBe(false);
    expect(isWorkloadResponse(42)).toBe(false);
  });

  it("rejects a message without a type tag", () => {
    expect(isWorkloadResponse({})).toBe(false);
    expect(isWorkloadResponse({ callId: 1, call: {} })).toBe(false);
  });

  it("rejects an unknown tag", () => {
    expect(isWorkloadResponse({ type: "nope" })).toBe(false);
    // host-reply is a main → worker request, never a worker response.
    expect(isWorkloadResponse({ type: "host-reply", callId: 1 })).toBe(false);
  });
});

describe("workload envelope types", () => {
  it("old-arity generic instantiations still compile", () => {
    // New type params must default, so pre-existing two/one-param forms
    // stay valid without edits.
    const req: WorkloadRequest<{ j: 1 }> = {
      type: "run",
      id: 1,
      job: { j: 1 },
    };
    const res: WorkloadResponse<number, string> = {
      type: "done",
      id: 1,
      result: 2,
    };
    expect(req.type).toBe("run");
    expect(res.type).toBe("done");
  });
});
