import * as assert from "assert";
import {
  isBinaryTrajectoryPath,
  isMolecularPath,
  isSketchPath,
  WORKSPACE_FILE_EXCLUDE,
  workspaceMolecularIncludeGlob,
  workspaceMolecularIncludeGlobs,
} from "../../src/extension/loading/molecularMatch";

suite("molecularMatch", () => {
  test("isMolecularPath accepts registry extensions and VASP names", () => {
    assert.strictEqual(isMolecularPath("/tmp/1abc.pdb"), true);
    assert.strictEqual(isMolecularPath("/tmp/frame.extxyz"), true);
    assert.strictEqual(isMolecularPath("/tmp/CHGCAR"), true);
    assert.strictEqual(isMolecularPath("/tmp/POSCAR_relax"), true);
  });

  test("isMolecularPath accepts .dump.local compound suffixes", () => {
    assert.strictEqual(isMolecularPath("/runs/bonds.dump.local"), true);
    assert.strictEqual(isMolecularPath("/runs/BONDS.DUMP.LOCAL"), true);
    assert.strictEqual(isMolecularPath("/runs/notes.local"), false);
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

  test("workspaceMolecularIncludeGlobs covers .dump.local", () => {
    assert.ok(workspaceMolecularIncludeGlobs().includes("**/*.dump.local"));
  });
});

suite("molecularMatch / packed mrec", () => {
  test("isMolecularPath accepts .mrec.zip archives", () => {
    assert.strictEqual(isMolecularPath("/runs/growth.mrec.zip"), true);
    assert.strictEqual(isMolecularPath("/runs/growth.zip"), false);
  });

  test("workspace globs include the packed store", () => {
    assert.ok(workspaceMolecularIncludeGlobs().includes("**/*.mrec.zip"));
  });
});

suite("molecularMatch / STL meshes", () => {
  test("isMolecularPath accepts an .stl mesh", () => {
    // It has no `FileFormat` — the mesh ingress opens it — but the Files view
    // and the open commands still have to offer it.
    assert.strictEqual(isMolecularPath("/runs/cavity.stl"), true);
    assert.strictEqual(isMolecularPath("/runs/cavity.stlx"), false);
  });

  test("workspace globs include meshes", () => {
    assert.ok(workspaceMolecularIncludeGlobs().includes("**/*.stl"));
  });
});

suite("molecularMatch / scan cost", () => {
  test("the combined glob is one pattern covering the same extensions", () => {
    // One pattern is one directory walk. Running the list a glob at a time
    // paid for the whole workspace once per entry, which is what made the
    // Files view spin forever on a large tree.
    const glob = workspaceMolecularIncludeGlob();
    assert.ok(glob.startsWith("**/{") && glob.endsWith("}"));
    for (const ext of ["pdb", "xyz", "lammpstrj", "xtc", "stl"]) {
      assert.ok(glob.includes(`*.${ext}`), `missing *.${ext}: ${glob}`);
    }
    for (const name of ["CHGCAR", "POSCAR_*", "CONTCAR"]) {
      assert.ok(glob.includes(name), `missing ${name}: ${glob}`);
    }
    assert.ok(glob.includes("*.dump.local"));
    // A path separator cannot ride in the alternation; the mrec store root is
    // found by its own pattern.
    assert.ok(!glob.includes("/zarr.json"));
  });

  test("the exclude skips the trees that make a scan unbounded", () => {
    // Each of these runs to tens of thousands of files in a working repo, and
    // none of them holds a molecular file worth listing.
    for (const dir of [
      "node_modules",
      "target",
      ".conda",
      "site-packages",
      ".cache",
      "__pycache__",
      "build",
      ".venv",
      ".git",
    ]) {
      assert.ok(
        WORKSPACE_FILE_EXCLUDE.includes(dir),
        `${dir} is not excluded: ${WORKSPACE_FILE_EXCLUDE}`,
      );
    }
  });
});
