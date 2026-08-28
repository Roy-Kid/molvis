import { toDomainUint } from "@molcrafts/molvis-core";
import { Block } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import { readAtomTypeKeys } from "../src/atom_type";

describe("readAtomTypeKeys", () => {
  it("returns string force-field labels from type", () => {
    const atoms = new Block();
    atoms.setColStr("type", ["opls_1", "opls_2"]);
    expect(readAtomTypeKeys(atoms)).toEqual(["opls_1", "opls_2"]);
  });

  it("stringifies LAMMPS type_id ordinals", () => {
    const atoms = new Block();
    atoms.setColU32("type_id", toDomainUint([1, 3, 1]));
    expect(readAtomTypeKeys(atoms)).toEqual(["1", "3", "1"]);
  });

  it("prefers the type label when both columns exist", () => {
    const atoms = new Block();
    atoms.setColStr("type", ["CT", "HA"]);
    atoms.setColU32("type_id", toDomainUint([1, 2]));
    expect(readAtomTypeKeys(atoms)).toEqual(["CT", "HA"]);
  });

  it("returns undefined when neither column exists", () => {
    expect(readAtomTypeKeys(new Block())).toBeUndefined();
  });

  it("throws when type_id is present as the wrong dtype", () => {
    const atoms = {
      hasStr: () => false,
      hasU32: () => false,
      dtype: (name: string) => (name === "type_id" ? "i32" : undefined),
      getStr: () => {
        throw new Error("should not read");
      },
      getU32: () => {
        throw new Error("should not read");
      },
    };
    expect(() => readAtomTypeKeys(atoms)).toThrow(/type_id.*u64/);
  });
});
