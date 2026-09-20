import { Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import "../setup_wasm";
import { toDomainUint } from "@molcrafts/molvis-core";
import { composeSources } from "../../src/system/source_composition";
import { Trajectory } from "../../src/system/trajectory";

function topoFrame(): Frame {
  const f = new Frame();
  const b = f.createBlock("atoms");
  // LAMMPS data: file order is NOT id order (ids permuted).
  b.setColU32("id", toDomainUint([3, 1, 2]));
  b.setColStr("element", ["C", "O", "H"]);
  return f;
}

function trajFrame(seed: number): Frame {
  const f = new Frame();
  const b = f.createBlock("atoms");
  const n = 3;
  const id = new Uint32Array(n);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    id[i] = i + 1;
    x[i] = seed + i * 0.1;
    y[i] = seed + i * 0.2;
    z[i] = seed + i * 0.3;
  }
  b.setColU32("id", toDomainUint(id));
  b.setColF("x", x);
  b.setColF("y", y);
  b.setColF("z", z);
  return f;
}

describe("topology + trajectory composition", () => {
  it("reorders trajectory rows by id on every frame", async () => {
    const topo = new Trajectory([topoFrame()]);
    const traj = new Trajectory([trajFrame(0), trajFrame(1), trajFrame(2)]);

    for (let i = 0; i < 3; i++) {
      const composed = await composeSources(
        [
          { id: "topo", trajectory: topo },
          { id: "traj", trajectory: traj },
        ],
        i,
      );
      const atoms = composed.getBlock("atoms");
      expect(atoms?.nrows()).toBe(3);
      const x = atoms?.viewColF("x");
      // Composition keeps the topology's row order, not the trajectory's.
      expect(Array.from(atoms?.viewColU32("id") ?? [], Number)).toEqual([
        3, 1, 2,
      ]);
      // Topology id order [3,1,2] maps trajectory rows [1,2,3] -> [3,1,2].
      // x[trajectory row for id 3] = seed + 2*0.1 must land at topology row 0.
      expect(x?.[0]).toBeCloseTo(i + 0.2, 5);
      expect(x?.[1]).toBeCloseTo(i + 0.0, 5);
      expect(x?.[2]).toBeCloseTo(i + 0.1, 5);
    }
  });
});
