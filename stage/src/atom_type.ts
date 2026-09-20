/**
 * Per-atom type keys for palette assignment and Select Type.
 *
 * molrs splits the quantity: `type` is the force-field label (string);
 * `type_id` is the LAMMPS ordinal (u32). Data/dump readers write the
 * ordinal as `type_id`. A numeric `type` column is not a valid spelling.
 */
import { TYPE, TYPE_ID } from "@molcrafts/molvis-core/keys";

/** Read side needed to resolve type keys — molrs `Block` satisfies this. */
export interface AtomTypeSource {
  hasStr(name: string): boolean;
  hasU32(name: string): boolean;
  dtype(name: string): string | undefined;
  getStr(name: string): string[];
  getU32(name: string): BigUint64Array;
}

/**
 * One string key per atom, or `undefined` when the frame has neither
 * `type` nor `type_id`. Prefer the label (`type`); otherwise stringify
 * `type_id`. A present column of the wrong dtype is an error.
 */
export function readAtomTypeKeys(atoms: AtomTypeSource): string[] | undefined {
  if (atoms.hasStr(TYPE)) {
    return atoms.getStr(TYPE).map(String);
  }
  const typeDtype = atoms.dtype(TYPE);
  if (typeDtype !== undefined) {
    throw new Error(`column '${TYPE}' must be string, got '${typeDtype}'`);
  }
  if (atoms.hasU32(TYPE_ID)) {
    return Array.from(atoms.getU32(TYPE_ID), String);
  }
  const idDtype = atoms.dtype(TYPE_ID);
  if (idDtype !== undefined) {
    throw new Error(`column '${TYPE_ID}' must be u64, got '${idDtype}'`);
  }
  return undefined;
}
