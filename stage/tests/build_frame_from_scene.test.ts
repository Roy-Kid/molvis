import { Box, Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import { AtomSource, BondSource } from "../src/entity_source";
import type { SceneIndex } from "../src/scene_index";
import {
  buildFrameFromScene,
  materializeFrameFromScene,
} from "../src/scene_sync";

// buildFrameFromScene only touches sceneIndex.metaRegistry.{atoms,bonds} and
// markAllSaved(), so a mock backed by real AtomSource/BondSource suffices —
// no BabylonJS scene needed.
function mockSceneIndex(atoms: AtomSource, bonds: BondSource): SceneIndex {
  return {
    metaRegistry: { atoms, bonds },
    markAllSaved() {},
  } as unknown as SceneIndex;
}

function sceneWith3Atoms(): SceneIndex {
  const atoms = new AtomSource();
  atoms.setEdit(0, {
    type: "atom",
    atomId: 0,
    element: "C",
    position: { x: 1, y: 2, z: 3 },
  });
  atoms.setEdit(1, {
    type: "atom",
    atomId: 1,
    element: "H",
    position: { x: 4, y: 5, z: 6 },
  });
  const bonds = new BondSource();
  bonds.setEdit(0, {
    type: "bond",
    bondId: 0,
    atomId1: 0,
    atomId2: 1,
    bondType: 2,
    bondNumber: 2,
    start: { x: 1, y: 2, z: 3 },
    end: { x: 4, y: 5, z: 6 },
  });
  return mockSceneIndex(atoms, bonds);
}

describe("buildFrameFromScene", () => {
  it("builds a new Frame with the scene's atoms and bonds", () => {
    const frame = buildFrameFromScene(sceneWith3Atoms());
    const a = frame.getBlock("atoms");
    expect(a?.nrows()).toBe(2);
    const x = a?.viewColF("x");
    expect(x && Array.from(x)).toEqual([1, 4]);
    const b = frame.getBlock("bonds");
    expect(b?.nrows()).toBe(1);
    expect(b?.viewColU32("bond_type")?.[0]).toBe(2);
    expect(b?.viewColU32("bond_number")?.[0]).toBe(2);
  });

  it("preserves BondMeta aromatic bond_type=4, bond_number=0", () => {
    const atoms = new AtomSource();
    atoms.setEdit(0, {
      type: "atom",
      atomId: 0,
      element: "C",
      position: { x: 0, y: 0, z: 0 },
    });
    atoms.setEdit(1, {
      type: "atom",
      atomId: 1,
      element: "C",
      position: { x: 1.4, y: 0, z: 0 },
    });
    const bonds = new BondSource();
    bonds.setEdit(0, {
      type: "bond",
      bondId: 0,
      atomId1: 0,
      atomId2: 1,
      bondType: 4,
      bondNumber: 0,
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1.4, y: 0, z: 0 },
    });

    const frame = buildFrameFromScene(mockSceneIndex(atoms, bonds));
    const b = frame.getBlock("bonds");
    expect(b?.viewColU32("bond_type")?.[0]).toBe(4);
    expect(b?.viewColU32("bond_number")?.[0]).toBe(0);
  });

  it("preserves the simulation box from the source frame", () => {
    const sourceFrame = new Frame();
    sourceFrame.box = Box.cube(
      10,
      new Float64Array([0, 0, 0]),
      true,
      true,
      true,
    );
    const frame = buildFrameFromScene(sceneWith3Atoms(), { sourceFrame });
    expect(frame.box).toBeTruthy();
    // The source frame keeps its own box (getter→setter move pattern).
    expect(sourceFrame.box).toBeTruthy();
  });

  it("does NOT mutate/clear the source frame (immutability)", () => {
    const sourceFrame = new Frame();
    sourceFrame.box = Box.cube(
      5,
      new Float64Array([0, 0, 0]),
      true,
      true,
      true,
    );
    buildFrameFromScene(sceneWith3Atoms(), { sourceFrame });
    // Source frame must remain usable and box intact after the build.
    expect(() => sourceFrame.box).not.toThrow();
    expect(sourceFrame.box).toBeTruthy();
  });

  it("materializeFrameFromScene maps sparse edit ids to dense rows", () => {
    const atoms = new AtomSource();
    atoms.setEdit(10, {
      type: "atom",
      atomId: 10,
      element: "C",
      position: { x: 1, y: 0, z: 0 },
    });
    atoms.setEdit(20, {
      type: "atom",
      atomId: 20,
      element: "O",
      position: { x: 2, y: 0, z: 0 },
    });
    const bonds = new BondSource();
    bonds.setEdit(7, {
      type: "bond",
      bondId: 7,
      atomId1: 10,
      atomId2: 20,
      bondType: 1,
      bondNumber: 1,
      start: { x: 1, y: 0, z: 0 },
      end: { x: 2, y: 0, z: 0 },
    });

    const built = materializeFrameFromScene(mockSceneIndex(atoms, bonds));
    expect(built.frame.getBlock("atoms")?.nrows()).toBe(2);
    expect(built.atomIdToFrameIndex.get(10)).toBe(0);
    expect(built.atomIdToFrameIndex.get(20)).toBe(1);
    expect(built.bondIdToFrameIndex.get(7)).toBe(0);
    // Endpoints renumbered into dense atom rows.
    expect(built.frame.getBlock("bonds")?.viewColU32("atomi")?.[0]).toBe(0);
    expect(built.frame.getBlock("bonds")?.viewColU32("atomj")?.[0]).toBe(1);
  });
});
