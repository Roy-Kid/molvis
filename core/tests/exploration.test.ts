import { type Frame, XYZReader } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import {
  aggregateFrameLabels,
  runExploration,
} from "../src/analysis/exploration";

/**
 * Build a one-atom ExtXYZ frame with `key=value` comment-line properties.
 *
 * ExtXYZ is the only path to a `Frame` with populated `meta` from the WASM
 * side — there is no direct `setMetaScalar` binding, so tests that need
 * per-frame labels round-trip through `XYZReader`.
 */
function makeExtxyzFrame(meta: Record<string, string | number>): Frame {
  const parts = Object.entries(meta).map(([k, v]) => {
    if (typeof v === "string") return `${k}="${v}"`;
    return `${k}=${v}`;
  });
  const comment = parts.join(" ");
  const text = `1\n${comment}\nAr 0.0 0.0 0.0\n`;
  const reader = new XYZReader(text);
  const frame = reader.read(0);
  if (!frame) throw new Error("failed to parse ExtXYZ fixture");
  return frame;
}

describe("aggregateFrameLabels", () => {
  it("returns an empty map for zero frames", () => {
    const result = aggregateFrameLabels([]);
    expect(result.size).toBe(0);
  });

  it("aggregates a numeric key across frames with NaN for missing values", () => {
    const frames = [
      makeExtxyzFrame({ energy: 1.0 }),
      makeExtxyzFrame({ other: 5.0 }),
      makeExtxyzFrame({ energy: 2.0 }),
    ];
    const result = aggregateFrameLabels(frames);

    expect(result.has("energy")).toBe(true);
    const energy = result.get("energy");
    expect(energy).toBeInstanceOf(Float64Array);
    expect(energy?.length).toBe(3);
    expect(energy?.[0]).toBe(1.0);
    expect(Number.isNaN(energy?.[1] ?? 0)).toBe(true);
    expect(energy?.[2]).toBe(2.0);
  });

  it("drops purely-categorical keys", () => {
    const frames = [
      makeExtxyzFrame({ energy: 1.0, config: "trans" }),
      makeExtxyzFrame({ energy: 2.0, config: "cis" }),
    ];
    const result = aggregateFrameLabels(frames);

    expect(result.has("energy")).toBe(true);
    expect(result.has("config")).toBe(false);
  });
});

describe("runExploration", () => {
  it("projects a 3-cluster layout via PCA and labels with k-means", async () => {
    const nPerCluster = 50;
    const nFrames = nPerCluster * 3;
    const x = new Float64Array(nFrames);
    const y = new Float64Array(nFrames);

    // Three well-separated clusters along the x-axis, tight scatter in y.
    for (let i = 0; i < nPerCluster; i++) {
      const jitter = (i / nPerCluster) * 0.3;
      x[i] = 0 + jitter;
      y[i] = 0 + jitter * 0.1;
      x[nPerCluster + i] = 10 + jitter;
      y[nPerCluster + i] = 0 + jitter * 0.1;
      x[2 * nPerCluster + i] = 20 + jitter;
      y[2 * nPerCluster + i] = 0 + jitter * 0.1;
    }

    const frameLabels = new Map<string, Float64Array>();
    frameLabels.set("x", x);
    frameLabels.set("y", y);

    const result = await runExploration(frameLabels, {
      descriptorNames: ["x", "y"],
      reduction: { method: "pca" },
      clustering: { method: "kmeans", k: 3, seed: 42 },
      colorBy: { kind: "cluster" },
    });

    expect(result.embedding.coords.length).toBe(2 * nFrames);
    for (let i = 0; i < result.embedding.coords.length; i++) {
      expect(Number.isFinite(result.embedding.coords[i])).toBe(true);
    }

    expect(result.embedding.variance[0]).toBeGreaterThanOrEqual(
      result.embedding.variance[1],
    );

    expect(result.clusters).toBeInstanceOf(Int32Array);
    expect(result.clusters?.length).toBe(nFrames);
    const unique = new Set<number>();
    for (const label of result.clusters ?? []) unique.add(label);
    expect(unique.size).toBe(3);

    expect(result.descriptors.nFrames).toBe(nFrames);
    expect(result.descriptors.nDescriptors).toBe(2);
    expect(result.descriptors.names).toEqual(["x", "y"]);
  });

  it("skips clustering when method is 'none'", async () => {
    const nFrames = 30;
    const x = new Float64Array(nFrames);
    const y = new Float64Array(nFrames);
    for (let i = 0; i < nFrames; i++) {
      x[i] = i;
      y[i] = i * 0.5;
    }

    const frameLabels = new Map<string, Float64Array>();
    frameLabels.set("x", x);
    frameLabels.set("y", y);

    const result = await runExploration(frameLabels, {
      descriptorNames: ["x", "y"],
      reduction: { method: "pca" },
      clustering: { method: "none" },
      colorBy: { kind: "frame-index" },
    });

    expect(result.clusters).toBe(null);
    expect(result.embedding.coords.length).toBe(2 * nFrames);
  });

  it("throws when a selected column contains NaN, naming the column", async () => {
    const nFrames = 20;
    const clean = new Float64Array(nFrames);
    const dirty = new Float64Array(nFrames);
    for (let i = 0; i < nFrames; i++) {
      clean[i] = i;
      dirty[i] = i;
    }
    dirty[5] = Number.NaN;

    const frameLabels = new Map<string, Float64Array>();
    frameLabels.set("clean", clean);
    frameLabels.set("bad_col", dirty);

    await expect(
      runExploration(frameLabels, {
        descriptorNames: ["clean", "bad_col"],
        reduction: { method: "pca" },
        clustering: { method: "none" },
        colorBy: { kind: "solid" },
      }),
    ).rejects.toThrow(/bad_col/);
  });

  it("throws when descriptorNames has fewer than 2 entries", async () => {
    const frameLabels = new Map<string, Float64Array>();
    frameLabels.set("only", new Float64Array([1, 2, 3, 4, 5]));

    await expect(
      runExploration(frameLabels, {
        descriptorNames: ["only"],
        reduction: { method: "pca" },
        clustering: { method: "none" },
        colorBy: { kind: "solid" },
      }),
    ).rejects.toThrow(/at least 2/);
  });

  it("throws when a selected descriptor is missing from frameLabels", async () => {
    const frameLabels = new Map<string, Float64Array>();
    frameLabels.set("a", new Float64Array([1, 2, 3]));
    frameLabels.set("b", new Float64Array([4, 5, 6]));

    await expect(
      runExploration(frameLabels, {
        descriptorNames: ["a", "missing"],
        reduction: { method: "pca" },
        clustering: { method: "none" },
        colorBy: { kind: "solid" },
      }),
    ).rejects.toThrow(/missing/);
  });

  it("formats axis labels with explained-variance percentages", async () => {
    const nFrames = 30;
    const x = new Float64Array(nFrames);
    const y = new Float64Array(nFrames);
    for (let i = 0; i < nFrames; i++) {
      x[i] = i;
      y[i] = i * 0.1 + (i % 2) * 0.01;
    }

    const frameLabels = new Map<string, Float64Array>();
    frameLabels.set("x", x);
    frameLabels.set("y", y);

    const result = await runExploration(frameLabels, {
      descriptorNames: ["x", "y"],
      reduction: { method: "pca" },
      clustering: { method: "none" },
      colorBy: { kind: "solid" },
    });

    expect(result.embedding.axes[0]).toMatch(/^PC1( \(.+\))?$/);
    expect(result.embedding.axes[1]).toMatch(/^PC2( \(.+\))?$/);
  });
});
