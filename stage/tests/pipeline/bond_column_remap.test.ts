import { toDomainUint } from "@molcrafts/molvis-core";
import { Block, Box, Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import "../setup_wasm";
import {
  BondColumnRemapModifier,
  inferBondColumnMapping,
} from "../../src/pipeline/bond_column_remap";
import type { PipelineContext } from "../../src/pipeline/types";

/** Bonds keyed by persistent atom id (LAMMPS `dump local` shape). */
function frameWithIdBonds(): Frame {
  const frame = new Frame();
  const atoms = new Block();
  atoms.setColF("x", new Float64Array([0, 1, 2]));
  atoms.setColF("y", new Float64Array(3));
  atoms.setColF("z", new Float64Array(3));
  atoms.setColU32("id", toDomainUint([30, 10, 20]));
  frame.insertBlock("atoms", atoms);
  const bonds = new Block();
  bonds.setColU32("id_i", toDomainUint([10, 20]));
  bonds.setColU32("id_j", toDomainUint([20, 30]));
  frame.insertBlock("bonds", bonds);
  frame.box = Box.cube(5, new Float64Array([0, 0, 0]), true, true, true);
  return frame;
}

describe("BondColumnRemapModifier", () => {
  it("writes canonical atomi/atomj onto a new frame and leaves the input untouched", () => {
    const modifier = new BondColumnRemapModifier("remap", {
      atomiSource: "id_i",
      atomjSource: "id_j",
      offset: 0,
    });
    const input = frameWithIdBonds();

    const out = modifier.apply(input, {} as PipelineContext);

    expect(out).not.toBe(input);
    const bonds = out.getBlock("bonds");
    expect(Array.from(bonds?.copyColU32("atomi") ?? [], Number)).toEqual([
      1, 2,
    ]);
    expect(Array.from(bonds?.copyColU32("atomj") ?? [], Number)).toEqual([
      2, 0,
    ]);
    // Copy-on-write: the input (possibly a cached provider frame) is intact.
    const inputBonds = input.getBlock("bonds");
    expect(inputBonds?.dtype("atomi")).toBeUndefined();
    expect(inputBonds?.dtype("atomj")).toBeUndefined();
    expect(out.getBlock("atoms")?.nrows()).toBe(3);
    const box = out.box;
    try {
      expect(box?.volume()).toBe(125);
    } finally {
      box?.free();
    }
  });

  it("throws when a bond endpoint id is missing from atoms.id", () => {
    const modifier = new BondColumnRemapModifier("remap", {
      atomiSource: "id_i",
      atomjSource: "id_j",
      offset: 0,
    });
    const input = frameWithIdBonds();
    const bonds = input.getBlock("bonds");
    bonds?.setColU32("id_i", toDomainUint([10, 99]));

    expect(() => modifier.apply(input, {} as PipelineContext)).toThrow(
      /not in this structure's atom id column/,
    );
  });

  it("passes a frame that already has atomi/atomj through by identity", () => {
    const modifier = new BondColumnRemapModifier("remap", {
      atomiSource: "id_i",
      atomjSource: "id_j",
      offset: 0,
    });
    const input = frameWithIdBonds();
    const once = modifier.apply(input, {} as PipelineContext);
    expect(modifier.apply(once, {} as PipelineContext)).toBe(once);
  });
});

/** Bonds in the `batom1`/`batom2` shape a LAMMPS `dump local` overlay has. */
function frameWithDumpLocalBonds(): Frame {
  const frame = new Frame();
  const bonds = new Block();
  bonds.setColU32("batom1", toDomainUint([10, 20]));
  bonds.setColU32("batom2", toDomainUint([20, 30]));
  frame.insertBlock("bonds", bonds);
  return frame;
}

describe("inferBondColumnMapping", () => {
  it("maps the dump local endpoint pair without asking", () => {
    expect(inferBondColumnMapping(frameWithDumpLocalBonds())).toEqual({
      atomiSource: "batom1",
      atomjSource: "batom2",
      offset: 0,
    });
  });

  it("declines endpoint names it cannot recognise", () => {
    expect(inferBondColumnMapping(frameWithIdBonds())).toBe(null);
  });

  it("declines a bonds block missing one of the pair", () => {
    const frame = new Frame();
    const bonds = new Block();
    bonds.setColU32("batom1", toDomainUint([10, 20]));
    frame.insertBlock("bonds", bonds);
    expect(inferBondColumnMapping(frame)).toBe(null);
  });

  it("declines an empty bonds block", () => {
    const frame = new Frame();
    frame.insertBlock("bonds", new Block());
    expect(inferBondColumnMapping(frame)).toBe(null);
  });

  it("declines a frame with no bonds block", () => {
    expect(inferBondColumnMapping(new Frame())).toBe(null);
  });
});
