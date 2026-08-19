import * as assert from "assert";
import {
  FORMAT_MENU,
  formatMenuLabel,
} from "../../../src/extension/loading/formatMenu";

suite("formatMenu", () => {
  test("labels are software, file kind, and dotted suffix", () => {
    assert.strictEqual(
      formatMenuLabel({
        format: "xyz",
        software: "XYZ",
        kind: "coords",
        suffixes: [".xyz"],
      }),
      "XYZ coords - .xyz",
    );
    assert.strictEqual(
      formatMenuLabel({
        format: "lammps",
        software: "LAMMPS",
        kind: "data",
        suffixes: [".data"],
      }),
      "LAMMPS data - .data",
    );
    assert.strictEqual(
      formatMenuLabel({
        format: "lammps-dump",
        software: "LAMMPS",
        kind: "traj",
        suffixes: [".dump"],
      }),
      "LAMMPS traj - .dump",
    );
  });

  test("menu names the file kind and skips scientific titles", () => {
    const labels = FORMAT_MENU.map(formatMenuLabel);
    assert.ok(labels.includes("PDB structure - .pdb"));
    assert.ok(labels.includes("XYZ coords - .xyz"));
    assert.ok(labels.includes("LAMMPS data - .data"));
    assert.ok(labels.includes("LAMMPS traj - .dump"));
    assert.ok(labels.includes("VASP structure - POSCAR"));
    for (const label of labels) {
      assert.doesNotMatch(label, /Protein Data Bank|Crystallographic|Extended/);
      assert.match(label, / - (\.[a-z0-9]+|CHGCAR|POSCAR)/);
    }
  });

  test("covers every FileFormat id used by the host picker", () => {
    const formats = new Set(FORMAT_MENU.map((e) => e.format));
    for (const id of [
      "pdb",
      "xyz",
      "cif",
      "lammps",
      "lammps-dump",
      "sdf",
      "dcd",
      "cube",
      "chgcar",
      "gro",
      "mol2",
      "poscar",
      "trr",
      "xtc",
    ]) {
      assert.ok(formats.has(id as never), id);
    }
  });
});
