import { Block, Frame } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import "../tests/setup_wasm";
import { buildBondBuffers } from "../src/artist/bond_buffer";
import { AtomSource } from "../src/entity_source";
import { classifyFrameTransition } from "../src/system/frame_diff";

// Playback hot-path benchmarks (run via `npm run bench`, NOT part of `npm test`).
// They time the paths optimized in the core-review remediation: the frame-diff
// element cache, bond-buffer exact sizing, and the getMeta element-column cache.
// Use them to compare before/after an optimization. The timing report is thrown
// at the end so it surfaces despite rstest buffering console output — the run
// "fails" by design; that single failure IS the report.

const ELEMENTS = ["C", "H", "O", "N", "S"];

function makeFrame(nAtoms: number, nBonds: number): Frame {
  const f = new Frame();
  const atoms = new Block();
  const x = new Float64Array(nAtoms);
  const y = new Float64Array(nAtoms);
  const z = new Float64Array(nAtoms);
  const el: string[] = [];
  for (let i = 0; i < nAtoms; i++) {
    x[i] = (i % 100) * 0.5;
    y[i] = Math.floor(i / 100) * 0.5;
    z[i] = (i % 7) * 0.3;
    el.push(ELEMENTS[i % ELEMENTS.length]);
  }
  atoms.setColF("x", x);
  atoms.setColF("y", y);
  atoms.setColF("z", z);
  atoms.setColStr("element", el);
  f.insertBlock("atoms", atoms);

  if (nBonds > 0) {
    const bonds = new Block();
    const ai = new Uint32Array(nBonds);
    const aj = new Uint32Array(nBonds);
    const order = new Uint32Array(nBonds);
    for (let b = 0; b < nBonds; b++) {
      ai[b] = b % nAtoms;
      aj[b] = (b + 1) % nAtoms;
      order[b] = 1;
    }
    bonds.setColU32("atomi", ai);
    bonds.setColU32("atomj", aj);
    bonds.setColU32("order", order);
    f.insertBlock("bonds", bonds);
  }
  return f;
}

function time(label: string, iters: number, fn: (i: number) => void): string {
  fn(0); // warm up
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) fn(i);
  const ms = performance.now() - t0;
  return `${label}: ${ms.toFixed(2)}ms total, ${((ms / iters) * 1000).toFixed(3)}µs/op (${iters} ops)`;
}

describe("playback benchmarks", () => {
  it("times the optimized hot paths", () => {
    const N = 20_000;
    const report: string[] = [];

    // 1. classifyFrameTransition — element-column comparison is cached per Frame.
    const a = makeFrame(N, N);
    const b = makeFrame(N, N);
    expect(classifyFrameTransition(a, b).kind).toBeTruthy();
    report.push(
      time("classifyFrameTransition", 500, () => {
        classifyFrameTransition(a, b);
      }),
    );

    // 2. buildBondBuffers — exact sizing for single-order bonds (no 3x + trim).
    const atoms = a.getBlock("atoms") as Block;
    const bonds = a.getBlock("bonds") as Block;
    const color = new Float32Array(N * 4).fill(1);
    expect(buildBondBuffers(bonds, atoms, color, 1)?.instanceCount).toBe(N);
    report.push(
      time("buildBondBuffers", 50, () => {
        buildBondBuffers(bonds, atoms, color, 1);
      }),
    );

    // 3. AtomSource.getMeta — element column cached, not re-copied per pick.
    const src = new AtomSource();
    src.setFrame(makeFrame(N, 0));
    expect(src.getMeta(0)?.element).toBe("C");
    report.push(
      time("getMeta", 100_000, (i) => {
        src.getMeta(i % N);
      }),
    );

    // rstest buffers console.log; throwing surfaces the numbers. The run shows
    // one intentional failure carrying the report.
    throw new Error(`\n[BENCH report]\n  ${report.join("\n  ")}\n`);
  });
});
