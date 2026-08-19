import * as assert from "assert";
import {
  STREAMING_FILE_THRESHOLD_BYTES,
  TRAJECTORY_WHOLE_FILE_CAP_BYTES,
} from "@molcrafts/molvis-stage/io/formats";
import { decideMolecularLoadIntent } from "../../../src/extension/loading/molecularLoadIntent";

suite("molecularLoadIntent", () => {
  test("streams a 16 MiB dump as open-uri", () => {
    assert.deepStrictEqual(
      decideMolecularLoadIntent("lammps-dump", STREAMING_FILE_THRESHOLD_BYTES),
      { action: "open-uri" },
    );
  });

  test("streams a 512 MiB dump as open-uri", () => {
    assert.deepStrictEqual(
      decideMolecularLoadIntent("lammps-dump", TRAJECTORY_WHOLE_FILE_CAP_BYTES),
      { action: "open-uri" },
    );
  });

  test("opens a 2 GiB LAMMPS data file as read-bytes", () => {
    assert.deepStrictEqual(
      decideMolecularLoadIntent("lammps", 2 * 1024 * 1024 * 1024),
      { action: "read-bytes" },
    );
  });

  test("streams a 512 MiB DCD when range I/O is available", () => {
    assert.deepStrictEqual(
      decideMolecularLoadIntent("dcd", TRAJECTORY_WHOLE_FILE_CAP_BYTES),
      { action: "open-uri" },
    );
  });
});
