import { describe, expect, it } from "@rstest/core";
import { parseScopeRange } from "../../../../src/ui/layout/analysis/AnalysisScope";

describe("parseScopeRange", () => {
  it("fills an empty end when the index is complete", () => {
    const result = parseScopeRange(
      { start: "0", end: "", stride: "1", atoms: "all" },
      12,
      { indexComplete: true },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.range.endInclusive).toBe(11);
    }
  });

  it("rejects an empty end while the index is still scanning", () => {
    const result = parseScopeRange(
      { start: "0", end: "", stride: "1", atoms: "all" },
      12,
      { indexComplete: false },
    );
    expect(result).toEqual({ ok: false, reason: "needs-explicit-end" });
  });

  it("accepts an explicit end while scanning", () => {
    const result = parseScopeRange(
      { start: "0", end: "5", stride: "1", atoms: "all" },
      12,
      { indexComplete: false },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.range.endInclusive).toBe(5);
    }
  });
});
