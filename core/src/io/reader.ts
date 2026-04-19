import {
  type Frame,
  LAMMPSDumpReader,
  LAMMPSReader,
  PDBReader,
  XYZReader,
} from "@molcrafts/molrs";
import { writeBackboneBlock } from "../artist/ribbon/backbone_block";
import { logger } from "../utils/logger";
import { normalizeAtomCoords } from "./normalize_coords";

export type FileFormat = "pdb" | "xyz" | "lammps" | "lammps-dump";

/**
 * Infer a file format from the filename extension. Unknown extensions
 * fall through to `fallback` (default `"pdb"`).
 */
export function inferFormatFromFilename(
  filename: string,
  fallback: FileFormat = "pdb",
): FileFormat {
  const trimmed = filename.trim();
  const dot = trimmed.lastIndexOf(".");
  const ext = dot >= 0 ? trimmed.slice(dot + 1).toLowerCase() : "";
  switch (ext) {
    case "pdb":
      return "pdb";
    case "xyz":
      return "xyz";
    case "lammps":
    case "lmp":
    case "data":
      return "lammps";
    case "dump":
    case "lammpstrj":
      return "lammps-dump";
    default:
      return fallback;
  }
}

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
 * Column names, dtypes, and `simbox` come straight from molrs — the molpy
 * convention (`element`, `x`/`y`/`z`, `atomi`/`atomj` u32) is already what
 * each reader produces. Downstream code that needs a column and does not
 * find it should skip or throw; this loader does not guess.
 *
 * PDB gets a `residues` block attached when the file describes a backbone,
 * so the ribbon renderer can dispatch on data rather than format.
 */
export function readFrames(content: string, filename: string): Frame[] {
  const format = inferFormatFromFilename(filename);
  const reader = openReader(content, format);
  const frames: Frame[] = [];
  try {
    const count = reader.len();
    for (let step = 0; step < count; step++) {
      const frame = reader.read(step);
      if (!frame) {
        throw new Error(`${format} reader returned no frame at step ${step}`);
      }
      if (format === "pdb") {
        writeBackboneBlock(frame, content);
      }
      normalizeAtomCoords(frame);
      frames.push(frame);
    }
  } finally {
    reader.free();
  }
  logger.info(`[reader] Read ${frames.length} ${format} frame(s)`);
  return frames;
}
