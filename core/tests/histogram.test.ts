import { describe, expect, it } from "@rstest/core";
import { computeHistogram, discoverNumericColumns } from "../src/analysis/histogram";
import { initSync, Block } from "@molcrafts/molrs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(__filename);
const wasmPath = require.resolve("@molcrafts/molrs/molwasm_bg.wasm");
const wasmBuffer = readFileSync(wasmPath);
initSync({ module: wasmBuffer });

describe("computeHistogram", () => {
  it("should compute correct bin counts for uniform data", () => {
    // 10 values from 0 to 9
    const data = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const result = computeHistogram(data, 10);
    expect(result.counts.length).toBe(10);
    expect(result.edges.length).toBe(11);
    // Total should equal input length
    const total = Array.from(result.counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(10);
  });

  it("should compute correct stats", () => {
    const data = new Float32Array([1, 2, 3, 4, 5]);
    const result = computeHistogram(data, 5);
    expect(result.stats.count).toBe(5);
    expect(result.stats.min).toBe(1);
    expect(result.stats.max).toBe(5);
    expect(result.stats.mean).toBeCloseTo(3, 5);
    expect(result.stats.std).toBeCloseTo(Math.sqrt(2), 3);
  });

  it("should handle single-value data", () => {
    const data = new Float32Array([5, 5, 5, 5]);
    const result = computeHistogram(data, 10);
    expect(result.stats.min).toBe(5);
    expect(result.stats.max).toBe(5);
    expect(result.stats.std).toBe(0);
    // All values in one bin
    const total = Array.from(result.counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(4);
  });

  it("should handle empty data", () => {
    const data = new Float32Array(0);
    const result = computeHistogram(data, 10);
    expect(result.stats.count).toBe(0);
    expect(result.counts.length).toBe(10);
  });

  it("should respect custom range", () => {
    const data = new Float32Array([1, 2, 3, 4, 5]);
    const result = computeHistogram(data, 10, { min: 0, max: 10 });
    expect(result.edges[0]).toBe(0);
    expect(result.edges[10]).toBe(10);
  });

  it("should filter by indices when provided", () => {
    const data = new Float32Array([10, 20, 30, 40, 50]);
    const indices = new Set([1, 3]); // only values 20, 40
    const result = computeHistogram(data, 10, null, indices);
    expect(result.stats.count).toBe(2);
    expect(result.stats.min).toBe(20);
    expect(result.stats.max).toBe(40);
    expect(result.stats.mean).toBeCloseTo(30, 5);
  });

  it("should skip NaN and Infinity values", () => {
    const data = new Float32Array([1, Number.NaN, 3, Number.POSITIVE_INFINITY, 5]);
    const result = computeHistogram(data, 10);
    expect(result.stats.count).toBe(3); // 1, 3, 5
  });

  it("should produce correct number of edges and counts", () => {
    const data = new Float32Array([1, 2, 3]);
    const bins = 7;
    const result = computeHistogram(data, bins);
    expect(result.edges.length).toBe(bins + 1);
    expect(result.counts.length).toBe(bins);
  });

  it("should handle bin count of 1", () => {
    const data = new Float32Array([1, 2, 3, 4, 5]);
    const result = computeHistogram(data, 1);
    expect(result.counts.length).toBe(1);
    expect(result.counts[0]).toBe(5);
  });

  it("should handle negative values", () => {
    const data = new Float32Array([-5, -3, -1, 1, 3, 5]);
    const result = computeHistogram(data, 10);
    expect(result.stats.min).toBe(-5);
    expect(result.stats.max).toBe(5);
    expect(result.stats.mean).toBeCloseTo(0, 5);
  });
});

describe("discoverNumericColumns", () => {
  it("should find f32 columns", () => {
    const block = new Block();
    block.setColumnF32("x", new Float32Array([1]));
    block.setColumnF32("y", new Float32Array([1]));
    block.setColumnStrings("element", ["C"]);
    const cols = discoverNumericColumns(block);
    const names = cols.map((c) => c.name);
    expect(names).toContain("x");
    expect(names).toContain("y");
    expect(names).not.toContain("element");
  });

  it("should skip __ internal columns", () => {
    const block = new Block();
    block.setColumnF32("charge", new Float32Array([0.5]));
    block.setColumnF32("__color_r", new Float32Array([1.0]));
    const cols = discoverNumericColumns(block);
    const names = cols.map((c) => c.name);
    expect(names).toContain("charge");
    expect(names).not.toContain("__color_r");
  });
});
