import {
  type Frame,
  LAMMPSDumpReader,
  LAMMPSReader,
  PDBReader,
  XYZReader,
} from "@molcrafts/molrs";
import { writeBackboneBlock } from "../artist/ribbon/backbone_block";
import { logger } from "../utils/logger";
import {
  type FileFormat,
  getAllAcceptExtensions,
  inferFormatFromFilename,
} from "./formats";
import { normalizeAtomCoords } from "./normalize_coords";

export {
  describeFormat,
  type FileFormat,
  type FileFormatDescriptor,
  FILE_FORMAT_REGISTRY,
  getAllAcceptExtensions,
  inferFormatFromFilename,
} from "./formats";

interface MultiFrameReader {
  len(): number;
  read(step: number): Frame | undefined;
  free(): void;
}

function openReader(content: string, format: FileFormat): MultiFrameReader {
  switch (format) {
    case "pdb":
      return new PDBReader(content);
    case "xyz":
      return new XYZReader(content);
    case "lammps":
      return new LAMMPSReader(content);
    case "lammps-dump":
      return new LAMMPSDumpReader(content);
  }
}

/**
 * Read every frame from `content`. Single-frame formats (PDB, LAMMPS data)
 * return a one-element array; multi-frame formats (XYZ, LAMMPS dump) return
 * one entry per step.
 *
 * If `format` is omitted, the extension is used to dispatch. When the
 * extension is unrecognized and no `format` is supplied we throw, since
 * we would otherwise be picking a parser at random. Every UI-level
 * ingress point should catch that case and prompt the user.
 *
 * Column names, dtypes, and `simbox` come straight from molrs — the molpy
 * convention (`element`, `x`/`y`/`z`, `atomi`/`atomj` u32) is already what
 * each reader produces. Downstream code that needs a column and does not
 * find it should skip or throw; this loader does not guess.
 *
 * PDB gets a `residues` block attached when the file describes a backbone,
 * so the ribbon renderer can dispatch on data rather than format.
 */
export function readFrames(
  content: string,
  filename: string,
  format?: FileFormat,
): Frame[] {
  const resolved = format ?? inferFormatFromFilename(filename);
  if (!resolved) {
    throw new Error(
      `Unable to detect format from filename "${filename}". ` +
        `Supported extensions: ${getAllAcceptExtensions()}.`,
    );
  }
  const reader = openReader(content, resolved);
  const frames: Frame[] = [];
  try {
    const count = reader.len();
    for (let step = 0; step < count; step++) {
      const frame = reader.read(step);
      if (!frame) {
        throw new Error(`${resolved} reader returned no frame at step ${step}`);
      }
      if (resolved === "pdb") {
        writeBackboneBlock(frame, content);
      }
      normalizeAtomCoords(frame);
      frames.push(frame);
    }
  } finally {
    reader.free();
  }
  logger.info(`[reader] Read ${frames.length} ${resolved} frame(s)`);
  return frames;
}
