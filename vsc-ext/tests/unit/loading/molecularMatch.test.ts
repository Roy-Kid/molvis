import * as assert from "assert";
import {
  isBinaryTrajectoryPath,
  isMolecularPath,
  isSketchPath,
  workspaceMolecularIncludeGlobs,
} from "../../../src/extension/loading/molecularMatch";

suite("molecularMatch", () => {
  test("isMolecularPath accepts registry extensions and VASP names", () => {
    assert.strictEqual(isMolecularPath("/tmp/1abc.pdb"), true);
    assert.strictEqual(isMolecularPath("/tmp/frame.extxyz"), true);
    assert.strictEqual(isMolecularPath("/tmp/CHGCAR"), true);
    assert.strictEqual(isMolecularPath("/tmp/POSCAR_relax"), true);
  });

  test("isMolecularPath accepts .mrec directory stores", () => {
    assert.strictEqual(isMolecularPath("traj.mrec"), true);
    assert.strictEqual(isMolecularPath("traj.mrec/"), true);
    assert.strictEqual(isMolecularPath("traj.mrec/zarr.json"), true);
  });

  test("isMolecularPath rejects .zarr stores", () => {
    assert.strictEqual(isMolecularPath("traj.zarr"), false);
    assert.strictEqual(isMolecularPath("traj.zarr/"), false);
  });

  test("isMolecularPath rejects non-molecular paths", () => {
    assert.strictEqual(isMolecularPath("/tmp/notes.md"), false);
    assert.strictEqual(isMolecularPath("/tmp/package.json"), false);
  });

  test("isBinaryTrajectoryPath is DCD/TRR/XTC", () => {
    assert.strictEqual(isBinaryTrajectoryPath("/tmp/msd1.dcd"), true);
    assert.strictEqual(isBinaryTrajectoryPath("/tmp/run.xtc"), true);
    assert.strictEqual(isBinaryTrajectoryPath("/tmp/eq.data"), false);
  });

  test("isSketchPath is only MOL/SDF connection tables", () => {
    assert.strictEqual(isSketchPath("/tmp/drug.sdf"), true);
    assert.strictEqual(isSketchPath("/tmp/ligand.mol"), true);
    assert.strictEqual(isSketchPath("/tmp/1abc.pdb"), false);
  });

  test("workspaceMolecularIncludeGlobs covers extensions and VASP names", () => {
    const globs = workspaceMolecularIncludeGlobs();
    assert.ok(globs.some((g) => g.includes("pdb") && g.includes("xtc")));
    assert.ok(globs.includes("**/*.mrec/zarr.json"));
    assert.ok(!globs.includes("**/*.mrec"));
    assert.ok(globs.includes("**/CHGCAR"));
    assert.ok(globs.includes("**/POSCAR_*"));
  });
});
