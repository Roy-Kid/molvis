import { Frame } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import type { DatasetExploration } from "../src/analysis/exploration";
import { EventEmitter, type MolvisEventMap } from "../src/events";
import { System } from "../src/system";
import { Trajectory } from "../src/system/trajectory";

function makeFrames(n: number): Frame[] {
  const frames: Frame[] = [];
  for (let i = 0; i < n; i++) frames.push(new Frame());
  return frames;
}

function makeDummyExploration(): DatasetExploration {
  return {
    config: {
      descriptorNames: ["a", "b"],
      reduction: { method: "pca" },
      clustering: { method: "none" },
      colorBy: { kind: "solid" },
    },
    descriptors: {
      names: ["a", "b"],
      values: new Float64Array(4),
      nFrames: 2,
      nDescriptors: 2,
    },
    embedding: {
      coords: new Float64Array(4),
      variance: [1, 0],
      axes: ["PC1", "PC2"],
    },
    clusters: null,
    computedAt: 0,
  };
}

describe("System — exploration + frameLabels state slots", () => {
  describe("setExploration", () => {
    it("stores the value and emits exploration-change", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      const emitted: (DatasetExploration | null)[] = [];
      events.on("exploration-change", (v) => emitted.push(v));

      const next = makeDummyExploration();
      system.setExploration(next);

      expect(system.exploration).toBe(next);
      expect(emitted).toEqual([next]);
    });

    it("short-circuits when called with the same reference", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      const emitted: (DatasetExploration | null)[] = [];
      events.on("exploration-change", (v) => emitted.push(v));

      const next = makeDummyExploration();
      system.setExploration(next);
      system.setExploration(next);

      expect(emitted.length).toBe(1);
    });

    it("accepts null and clears the slot", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      system.setExploration(makeDummyExploration());
      expect(system.exploration).not.toBe(null);

      system.setExploration(null);
      expect(system.exploration).toBe(null);
    });
  });

  describe("setFrameLabels", () => {
    it("stores the map and emits frame-labels-change", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      const emitted: (Map<string, Float64Array> | null)[] = [];
      events.on("frame-labels-change", (v) => emitted.push(v));

      const labels = new Map<string, Float64Array>();
      labels.set("energy", new Float64Array([1, 2, 3]));
      system.setFrameLabels(labels);

      expect(system.frameLabels).toBe(labels);
      expect(emitted.length).toBe(1);
      expect(emitted[0]).toBe(labels);
    });

    it("short-circuits when called with the same reference", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      const emitted: (Map<string, Float64Array> | null)[] = [];
      events.on("frame-labels-change", (v) => emitted.push(v));

      const labels = new Map<string, Float64Array>();
      system.setFrameLabels(labels);
      system.setFrameLabels(labels);

      expect(emitted.length).toBe(1);
    });
  });

  describe("trajectory swap invalidation", () => {
    it("clears exploration and fires exploration-change(null) BEFORE trajectory-change", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);

      system.setExploration(makeDummyExploration());
      expect(system.exploration).not.toBe(null);

      const order: string[] = [];
      events.on("exploration-change", (v) => {
        order.push(
          v === null ? "exploration-change:null" : "exploration-change:value",
        );
      });
      events.on("trajectory-change", () => order.push("trajectory-change"));

      system.trajectory = new Trajectory(makeFrames(3));

      expect(system.exploration).toBe(null);
      expect(order[0]).toBe("exploration-change:null");
      expect(order).toContain("trajectory-change");
      const exIdx = order.indexOf("exploration-change:null");
      const trIdx = order.indexOf("trajectory-change");
      expect(exIdx).toBeLessThan(trIdx);
    });

    it("does NOT auto-clear frameLabels on trajectory swap (loader owns this)", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);

      const labels = new Map<string, Float64Array>();
      labels.set("energy", new Float64Array([1, 2, 3]));
      system.setFrameLabels(labels);

      system.trajectory = new Trajectory(makeFrames(3));

      expect(system.frameLabels).toBe(labels);
    });

    it("setFrame also invalidates exploration before its events", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);

      system.setExploration(makeDummyExploration());
      const order: string[] = [];
      events.on("exploration-change", (v) => {
        order.push(
          v === null ? "exploration-change:null" : "exploration-change:value",
        );
      });
      events.on("frame-change", () => order.push("frame-change"));

      system.setFrame(new Frame());

      expect(system.exploration).toBe(null);
      const exIdx = order.indexOf("exploration-change:null");
      const frIdx = order.indexOf("frame-change");
      expect(exIdx).toBeGreaterThanOrEqual(0);
      expect(frIdx).toBeGreaterThanOrEqual(0);
      expect(exIdx).toBeLessThan(frIdx);
    });
  });
});
