import { NullEngine } from "@babylonjs/core";
import { describe, expect, it } from "@rstest/core";
import "../setup_wasm";
import { loadFileContent } from "../../src/io";
import { MolvisRenderer } from "../../src/renderer";

const N_ATOMS = 6;

/** Atoms dump with the `id` column `dump local` endpoints resolve against. */
function atomsDump(): string {
  const lines = [
    "ITEM: TIMESTEP",
    "0",
    "ITEM: NUMBER OF ATOMS",
    String(N_ATOMS),
    "ITEM: BOX BOUNDS pp pp pp",
    "0 10",
    "0 10",
    "0 10",
    "ITEM: ATOMS id element mass x y z",
  ];
  // Ids descend so a correct remap cannot be confused with a row-order pass.
  for (let row = 0; row < N_ATOMS; row++) {
    const id = N_ATOMS - row;
    lines.push(`${id} C 12.011 ${row}.0 ${row}.5 ${row}.25`);
  }
  return `${lines.join("\n")}\n`;
}

/** Bond overlay in the `batom1`/`batom2` shape molrs writes. */
function bondOverlay(): string {
  const lines = [
    "ITEM: TIMESTEP",
    "0",
    "ITEM: NUMBER OF ENTRIES",
    String(N_ATOMS - 1),
    "ITEM: BOX BOUNDS pp pp pp",
    "0 10",
    "0 10",
    "0 10",
    "ITEM: ENTRIES batom1 batom2",
  ];
  for (let id = 1; id < N_ATOMS; id++) lines.push(`${id} ${id + 1}`);
  return `${lines.join("\n")}\n`;
}

describe("dump local overlay augment without a host picker", () => {
  it("maps batom1/batom2 and draws bonds", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const renderer = new MolvisRenderer(canvas, { engine: new NullEngine() });
    const app = renderer.app;
    await app.start();

    await loadFileContent(
      app,
      atomsDump(),
      "pack.lammpstrj",
      "lammps-dump",
      "replace",
    );
    expect(app.system.frame?.getBlock("atoms")?.nrows()).toBe(N_ATOMS);

    // No `pickBondMapping` argument — this is the VS Code webview host's
    // call shape, which used to leave the overlay unmapped and undrawn.
    await loadFileContent(
      app,
      bondOverlay(),
      "pack.dump.local",
      "lammps-dump",
      "augment",
    );

    const applied = await app.applyPipeline({ fullRebuild: true });
    const bonds = applied?.getBlock("bonds");
    expect(bonds?.nrows()).toBe(N_ATOMS - 1);
    // Ids descend, so id k lives at row N_ATOMS - k.
    expect(Array.from(bonds?.copyColU32("atomi") ?? [], Number)).toEqual([
      5, 4, 3, 2, 1,
    ]);
    expect(Array.from(bonds?.copyColU32("atomj") ?? [], Number)).toEqual([
      4, 3, 2, 1, 0,
    ]);

    const modifierNames = app.modifierPipeline.modifiers().map((m) => m.name);
    expect(modifierNames).toContain("Bonds");
  });
});

/**
 * The LAMMPS default: `dump local c_bond[1] c_bond[2]` with no
 * `dump_modify colname`. The label is the only thing saying these rows are
 * bonds, and the column names say nothing — so this is the file that must
 * reach the user instead of being guessed at.
 */
function defaultNamedBondOverlay(): string {
  const lines = [
    "ITEM: TIMESTEP",
    "0",
    "ITEM: NUMBER OF BONDS",
    String(N_ATOMS - 1),
    "ITEM: BOX BOUNDS pp pp pp",
    "0 10",
    "0 10",
    "0 10",
    "ITEM: BONDS index c_bond[1] c_bond[2]",
  ];
  for (let id = 1; id < N_ATOMS; id++) lines.push(`${id} ${id} ${id + 1}`);
  return `${lines.join("\n")}\n`;
}

describe("dump local overlay with default LAMMPS column names", () => {
  it("promotes on the section label and asks which columns are endpoints", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const renderer = new MolvisRenderer(canvas, { engine: new NullEngine() });
    const app = renderer.app;
    await app.start();

    await loadFileContent(
      app,
      atomsDump(),
      "pack.lammpstrj",
      "lammps-dump",
      "replace",
    );

    let asked: string[] | null = null;
    await loadFileContent(
      app,
      defaultNamedBondOverlay(),
      "pack.dump.local",
      "lammps-dump",
      "augment",
      async (_filename, candidates) => {
        asked = candidates;
        return {
          atomiSource: "c_bond[1]",
          atomjSource: "c_bond[2]",
          offset: 0,
        };
      },
    );

    // Reached the prompt at all: `ITEM: BONDS` promoted `entries` to `bonds`
    // even though not one column name is recognisable.
    expect(asked).not.toBe(null);
    expect(asked).toContain("c_bond[1]");
    expect(asked).toContain("c_bond[2]");

    const applied = await app.applyPipeline({ fullRebuild: true });
    const bonds = applied?.getBlock("bonds");
    expect(bonds?.nrows()).toBe(N_ATOMS - 1);
    expect(Array.from(bonds?.copyColU32("atomi") ?? [], Number)).toEqual([
      5, 4, 3, 2, 1,
    ]);
    expect(app.modifierPipeline.modifiers().map((m) => m.name)).toContain(
      "Bonds",
    );
  });
});
