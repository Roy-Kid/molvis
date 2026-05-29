import { Frame } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import { aggregateFrameLabels } from "../src/system/frame_labels";
import { Trajectory } from "../src/system/trajectory";

function makeFrame(meta: Record<string, string>): Frame {
  const frame = new Frame();
  for (const [key, value] of Object.entries(meta)) frame.setMeta(key, value);
  return frame;
}

describe("aggregateFrameLabels", () => {
  it("returns an empty map for an empty trajectory", () => {
    expect(aggregateFrameLabels(new Trajectory([])).size).toBe(0);
  });

  it("surfaces numeric meta as per-frame columns", () => {
    const traj = new Trajectory([
      makeFrame({ energy: "-1.23", temp: "300" }),
      makeFrame({ energy: "-1.50", temp: "310" }),
      makeFrame({ energy: "-1.10", temp: "305" }),
    ]);
    const labels = aggregateFrameLabels(traj);

    expect(labels.get("energy")?.length).toBe(3);
    expect(labels.get("energy")?.[0]).toBeCloseTo(-1.23, 10);
    expect(labels.get("temp")?.[1]).toBeCloseTo(310, 10);
  });

  it("drops purely categorical keys", () => {
    const traj = new Trajectory([
      makeFrame({ energy: "-1.23", config: "trans" }),
      makeFrame({ energy: "-1.50", config: "cis" }),
      makeFrame({ energy: "-1.10", config: "trans" }),
    ]);
    const labels = aggregateFrameLabels(traj);

    expect(labels.has("energy")).toBe(true);
    expect(labels.has("config")).toBe(false);
  });

  it("returns an empty map when no frame carries numeric meta", () => {
    const traj = new Trajectory([new Frame(), new Frame()]);
    expect(aggregateFrameLabels(traj).size).toBe(0);
  });

  it("stores NaN where a frame is missing an otherwise-numeric key", () => {
    const traj = new Trajectory([
      makeFrame({ energy: "-1.23" }),
      makeFrame({ temp: "300" }), // energy missing here
      makeFrame({ energy: "-1.10" }),
    ]);
    const energy = aggregateFrameLabels(traj).get("energy");

    expect(energy?.length).toBe(3);
    expect(energy?.[0]).toBeCloseTo(-1.23, 10);
    expect(Number.isNaN(energy?.[1] ?? 0)).toBe(true);
    expect(energy?.[2]).toBeCloseTo(-1.1, 10);
  });
});
