import { Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import "../setup_wasm";
import { toDomainUint } from "@molcrafts/molvis-core";
import { System } from "../../src/system";
import { composeSources } from "../../src/system/source_composition";
import { Trajectory } from "../../src/system/trajectory";

function topoFrame(): Frame {
  const f = new Frame();
  const b = f.createBlock("atoms");
  b.setColU32("id", toDomainUint([3, 1, 2]));
  b.setColStr("element", ["C", "O", "H"]);
  return f;
}

function trajFrame(seed: number, withId: boolean): Frame {
  const f = new Frame();
  const b = f.createBlock("atoms");
  const n = 3;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = seed + i * 0.1;
    y[i] = seed + i * 0.2;
    z[i] = seed + i * 0.3;
  }
  if (withId) {
    const id = new Uint32Array(n);
    for (let i = 0; i < n; i++) id[i] = i + 1;
    b.setColU32("id", toDomainUint(id));
  }
  b.setColF("x", x);
  b.setColF("y", y);
  b.setColF("z", z);
  return f;
}

describe("topology + trajectory navigation", () => {
  it("advances composed coordinates through System.nextFrame", async () => {
    const topo = new Trajectory([topoFrame()]);
    const dcd = new Trajectory([
      trajFrame(0, false),
      trajFrame(1, false),
      trajFrame(2, false),
    ]);

    const system = new System();
    await system.setTrajectory(topo);
    expect(system.trajectory.indexedLength).toBe(1);

    // SceneSession.addDataSource promotes System to the longer FileDataSource.
    await system.setTrajectory(dcd);
    expect(system.trajectory).toBe(dcd);

    for (let i = 1; i < 3; i++) {
      const ok = await system.seekFrame(i);
      expect(ok).toBe(true);
      const composed = await composeSources(
        [
          { id: "topo", trajectory: topo },
          { id: "dcd", trajectory: dcd },
        ],
        system.trajectory.currentIndex,
      );
      const x = composed.getBlock("atoms")?.viewColF("x");
      expect(x?.[1]).toBeCloseTo(i + 0.0, 5);
    }
  });
});
