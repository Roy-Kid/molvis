import type { Scene } from "@babylonjs/core";
import { describe, expect, it } from "@rstest/core";
import type { MolvisApp } from "../src/app";
import { Highlighter } from "../src/highlighter";
import type { SelectionState } from "../src/selection_manager";

// Structural fakes only: no Babylon scene, no SceneIndex, no MolvisApp. The
// Highlighter reads Babylon's CPU-side thin-instance storage and calls
// `thinInstanceSetBuffer`, so a mesh is a uniqueId + that storage + an upload
// log.

class FakeMesh {
  readonly uploads: string[] = [];
  readonly instanceColor: Float32Array;
  readonly instanceStyle: Float32Array;
  readonly _userThinInstanceBuffersStorage: {
    data: Record<string, Float32Array>;
  };

  constructor(
    readonly uniqueId: number,
    count: number,
  ) {
    this.instanceColor = new Float32Array(count * 4).fill(0.25);
    this.instanceStyle = new Float32Array(count * 4);
    this._userThinInstanceBuffersStorage = {
      data: {
        instanceColor: this.instanceColor,
        instanceStyle: this.instanceStyle,
      },
    };
  }

  thinInstanceSetBuffer(name: string): void {
    this.uploads.push(name);
  }

  count(name: string): number {
    return this.uploads.filter((n) => n === name).length;
  }
}

function selection(atoms: number[]): SelectionState {
  return {
    atoms: new Set(atoms),
    bonds: new Set(),
    revision: 1,
    highlightColor: null,
  };
}

function makeHighlighter(mesh: FakeMesh): Highlighter {
  const scene = {
    getMeshByUniqueId: (id: number) => (id === mesh.uniqueId ? mesh : null),
  } as unknown as Scene;
  const app = {
    styleManager: { getTheme: () => ({ selectionColor: "#ff0000" }) },
    world: {
      sceneIndex: {
        getSelectionKeyForAtom: (atomId: number) =>
          `${mesh.uniqueId}:${atomId}`,
        getSelectionKeysForBond: () => [],
        getMeta: () => undefined,
      },
      selectionManager: { getState: () => selection([]) },
    },
  } as unknown as MolvisApp;
  return new Highlighter(app, scene);
}

describe("Highlighter", () => {
  it("uploads instanceColor and instanceStyle once per pass, not once per atom", () => {
    const mesh = new FakeMesh(7, 4);
    const highlighter = makeHighlighter(mesh);

    highlighter.highlightSelection(selection([0, 1, 2]));

    expect(mesh.count("instanceColor")).toBe(1);
    expect(mesh.count("instanceStyle")).toBe(1);
    // Reveal flag set for every highlighted atom, left alone for the rest.
    expect([1, 5, 9, 13].map((i) => mesh.instanceStyle[i])).toEqual([
      1, 1, 1, 0,
    ]);
    // RGB overwritten (linear red), alpha preserved.
    expect(mesh.instanceColor[0]).toBeCloseTo(1, 5);
    expect(mesh.instanceColor[1]).toBeCloseTo(0, 5);
    expect(mesh.instanceColor[3]).toBeCloseTo(0.25, 5);
  });

  it("restores and re-hides in one upload each on clearAll", () => {
    const mesh = new FakeMesh(3, 3);
    const highlighter = makeHighlighter(mesh);
    highlighter.highlightSelection(selection([0, 1, 2]));

    highlighter.clearAll();

    expect(mesh.count("instanceColor")).toBe(2);
    expect(mesh.count("instanceStyle")).toBe(2);
    expect([1, 5, 9].map((i) => mesh.instanceStyle[i])).toEqual([0, 0, 0]);
    expect(mesh.instanceColor[0]).toBeCloseTo(0.25, 5);
  });

  it("does not upload when a pass changes nothing", () => {
    const mesh = new FakeMesh(1, 2);
    const highlighter = makeHighlighter(mesh);
    highlighter.highlightSelection(selection([1]));
    const before = mesh.uploads.length;

    highlighter.highlightSelection(selection([1]));

    expect(mesh.uploads.length).toBe(before);
  });
});
