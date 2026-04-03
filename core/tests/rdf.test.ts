import { Block, Box, Frame } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import { computeRdf } from "../src/analysis/rdf";

function makeFrame(positions: [number, number, number][]): Frame {
  const frame = new Frame();
  const atoms = new Block();
  atoms.setColF("x", new Float32Array(positions.map((p) => p[0])));
  atoms.setColF("y", new Float32Array(positions.map((p) => p[1])));
  atoms.setColF("z", new Float32Array(positions.map((p) => p[2])));
  atoms.setColStr(
    "element",
    positions.map(() => "Ar"),
  );
  frame.insertBlock("atoms", atoms);
  return frame;
}

function makePeriodicFrame(
  positions: [number, number, number][],
  boxSize: number,
): Frame {
  const frame = makeFrame(positions);
  const box = Box.cube(boxSize, new Float32Array([0, 0, 0]), true, true, true);
  frame.simbox = box;
  return frame;
}

describe("computeRdf", () => {
  it("returns null for empty frame", () => {
    expect(computeRdf(new Frame())).toBe(null);
  });

  it("returns null for single atom", () => {
    expect(computeRdf(makeFrame([[0, 0, 0]]))).toBe(null);
  });

  it("computes self-RDF for non-periodic atoms", () => {
    const frame = makeFrame([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ]);
    const result = computeRdf(frame, { nBins: 50 });
    expect(result).not.toBe(null);
    expect(result?.nBins).toBe(50);
    expect(result?.nParticles).toBe(3);
  });

  it("computes RDF for periodic system via WASM", () => {
    const positions: [number, number, number][] = [];
    for (let ix = 0; ix < 3; ix++)
      for (let iy = 0; iy < 3; iy++)
        for (let iz = 0; iz < 3; iz++) positions.push([ix * 2, iy * 2, iz * 2]);

    const result = computeRdf(makePeriodicFrame(positions, 6), { nBins: 50 });
    expect(result).not.toBe(null);
    expect(result?.rMax).toBeCloseTo(3.0, 1);
    const peakBin = Math.floor(2.0 / result?.dr);
    expect(result?.gr[peakBin]).toBeGreaterThan(1);
  });

  it("supports groupA self-RDF", () => {
    const frame = makeFrame([
      [0, 0, 0],
      [1, 0, 0],
      [5, 0, 0],
      [6, 0, 0],
    ]);
    const result = computeRdf(frame, { nBins: 50, groupA: [0, 1] });
    expect(result).not.toBe(null);
    expect(result?.nParticles).toBe(2);
  });

  it("supports groupA + groupB cross-RDF", () => {
    const frame = makeFrame([
      [0, 0, 0],
      [1, 0, 0],
      [5, 0, 0],
      [6, 0, 0],
    ]);
    const result = computeRdf(frame, {
      nBins: 50,
      groupA: [0, 1],
      groupB: [2, 3],
    });
    expect(result).not.toBe(null);
    // nParticles = reference group size (groupA)
    expect(result?.nParticles).toBe(2);
  });
});
