/**
 * Structure-file save defaults for the 3D stage.
 *
 * The picker/anchor mechanics live in `@molcrafts/ui-web-components/save-file`
 * — shared with the sketch board. What stays here is the part that is
 * actually chemistry: which formats the dialog should offer.
 */

import { saveBlob } from "@molcrafts/ui-web-components/save-file";

const STRUCTURE_FILE_TYPES = [
  {
    description: "Molecular structure files",
    accept: {
      "chemical/x-pdb": [".pdb"],
      "chemical/x-xyz": [".xyz"],
      "text/plain": [".lammps"],
    },
  },
];

export async function defaultSaveFile(
  blob: Blob,
  suggestedName: string,
): Promise<void> {
  await saveBlob(blob, suggestedName, { types: STRUCTURE_FILE_TYPES });
}
