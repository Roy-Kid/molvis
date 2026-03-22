import { describe, expect, it } from "@rstest/core";
import { deterministicSample, prepareScatter } from "../src/analysis/scatter";

describe("prepareScatter", () => {
  it("should return points with correct x/y values", () => {
    const x = new Float32Array([1, 2, 3]);
    const y = new Float32Array([10, 20, 30]);
    const result = prepareScatter(x, y);
    expect(result.points.length).toBe(3);
    expect(result.points[0].x).toBe(1);
    expect(result.points[0].y).toBe(10);
    expect(result.points[2].x).toBe(3);
    expect(result.points[2].y).toBe(30);
  });

  it("should compute correct ranges", () => {
    const x = new Float32Array([1, 5, 3]);
    const y = new Float32Array([-2, 8, 0]);
    const result = prepareScatter(x, y);
    expect(result.xRange.min).toBe(1);
    expect(result.xRange.max).toBe(5);
    expect(result.yRange.min).toBe(-2);
    expect(result.yRange.max).toBe(8);
  });

  it("should handle empty data", () => {
    const x = new Float32Array(0);
    const y = new Float32Array(0);
    const result = prepareScatter(x, y);
    expect(result.points.length).toBe(0);
    expect(result.totalCount).toBe(0);
  });

  it("should skip NaN values", () => {
    const x = new Float32Array([1, Number.NaN, 3]);
    const y = new Float32Array([10, 20, 30]);
    const result = prepareScatter(x, y);
    expect(result.totalCount).toBe(2);
  });

  it("should filter by indices", () => {
    const x = new Float32Array([1, 2, 3, 4, 5]);
    const y = new Float32Array([10, 20, 30, 40, 50]);
    const indices = new Set([1, 3]);
    const result = prepareScatter(x, y, 2000, indices);
    expect(result.totalCount).toBe(2);
    expect(result.points[0].x).toBe(2);
    expect(result.points[1].x).toBe(4);
  });

  it("should downsample when exceeding maxPoints", () => {
    const n = 5000;
    const x = new Float32Array(n).map((_, i) => i);
    const y = new Float32Array(n).map((_, i) => i * 2);
    const result = prepareScatter(x, y, 100);
    expect(result.sampledCount).toBe(100);
    expect(result.totalCount).toBe(5000);
  });

  it("should not downsample when under maxPoints", () => {
    const x = new Float32Array([1, 2, 3]);
    const y = new Float32Array([4, 5, 6]);
    const result = prepareScatter(x, y, 2000);
    expect(result.sampledCount).toBe(3);
    expect(result.totalCount).toBe(3);
  });

  it("should preserve index in points", () => {
    const x = new Float32Array([10, 20, 30]);
    const y = new Float32Array([1, 2, 3]);
    const result = prepareScatter(x, y);
    expect(result.points[0].index).toBe(0);
    expect(result.points[1].index).toBe(1);
    expect(result.points[2].index).toBe(2);
  });
});

describe("deterministicSample", () => {
  it("should return all items when under limit", () => {
    const items = [1, 2, 3];
    expect(deterministicSample(items, 10)).toEqual([1, 2, 3]);
  });

  it("should return exactly maxCount items", () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const result = deterministicSample(items, 10);
    expect(result.length).toBe(10);
  });

  it("should include first element", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const result = deterministicSample(items, 5);
    expect(result[0]).toBe(0);
  });

  it("should produce evenly spaced samples", () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const result = deterministicSample(items, 5);
    // Should be roughly 0, 20, 40, 60, 80
    for (let i = 1; i < result.length; i++) {
      const gap = result[i] - result[i - 1];
      expect(gap).toBeGreaterThanOrEqual(15);
      expect(gap).toBeLessThanOrEqual(25);
    }
  });
});
