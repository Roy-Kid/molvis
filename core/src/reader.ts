import { Frame, LammpsReader, PdbReader, XyzReader } from "@molcrafts/molrs";
import { logger } from "./utils/logger";
import { PeriodicTable } from "./system/elements";

export function readPDBFrame(content: string): Frame {
  const reader = new PdbReader(content);
  const frame = reader.read(0);
  reader.free();

  if (!frame) {
    throw new Error("PDB reader returned null frame");
  }

  const atomBlock = frame.getBlock("atoms");
  if (!atomBlock) {
    throw new Error("PDB frame has no atoms block");
  }

  if (!atomBlock.getColumnStrings("element")) {
    const typeSymbol = atomBlock.getColumnStrings("type_symbol");
    if (!typeSymbol) {
      throw new Error("PDB atoms block missing 'type_symbol' column");
    }
    atomBlock.setColumnStrings("element", typeSymbol);
  }

  logger.info("[reader] Successfully read PDB frame");
  return frame;
}

function processXYZFrame(frame: Frame): void {
  const atomBlock = frame.getBlock("atoms");
  if (!atomBlock) {
    throw new Error("XYZ frame has no atoms block");
  }

  if (!atomBlock.getColumnStrings("element")) {
    const symbol = atomBlock.getColumnStrings("species");
    if (!symbol) {
      throw new Error("XYZ atoms block missing 'species' column");
    }
    atomBlock.setColumnStrings("element", symbol);
  }
}

export function readXYZFrame(content: string): Frame {
  const reader = new XyzReader(content);
  const frame = reader.read(0);
  reader.free();

  if (!frame) {
    throw new Error("XYZ reader returned null frame");
  }

  processXYZFrame(frame);
  logger.info("[reader] Successfully read XYZ frame");
  return frame;
}

export function readLAMMPSData(content: string): Frame {
  const reader = new LammpsReader(content);
  const frame = reader.read(0);
  reader.free();

  if (!frame) {
    throw new Error("LAMMPS reader returned null frame");
  }

  const atomBlock = frame.getBlock("atoms");
  if (!atomBlock) {
    throw new Error("LAMMPS frame has no atoms block");
  }

  // LAMMPS format: element/type is in 'species' column
  if (!atomBlock.getColumnStrings("element")) {
    const species = atomBlock.getColumnStrings("species");
    if (!species) {
      throw new Error("LAMMPS atoms block missing 'species' column");
    }
    atomBlock.setColumnStrings("element", species);
  }

  // LAMMPS bonds: already uses 'i' and 'j', no mapping needed

  logger.info("[reader] Successfully read LAMMPS data frame");
  return frame;
}

/**
 * Unified helper to read a frame based on filename extension.
 * Dispatches to specific readers.
 *
 * @param content - File content as string
 * @param filename - Filename to infer format from
 * @returns Frame object
 */
export function readFrame(content: string, filename: string): Frame {
  const format = inferFormatFromFilename(filename);
  switch (format) {
    case "xyz":
      return readXYZFrame(content);
    case "lammps":
      return readLAMMPSData(content);
    default:
      return readPDBFrame(content);
  }
}

/**
 * Infers file format from filename extension.
 */
export function inferFormatFromFilename(
  filename: string,
  fallback = "pdb",
): string {
  const trimmed = filename.trim();
  const dot = trimmed.lastIndexOf(".");
  const ext = dot >= 0 ? trimmed.slice(dot + 1).toLowerCase() : "";

  if (ext === "pdb") return "pdb";
  if (ext === "xyz") return "xyz";
  if (ext === "lammps" || ext === "lmp" || ext === "data") return "lammps";

  return fallback;
}

/**
 * Derive an element symbol from an atom type name.
 * Tries full name, then first 2 chars, then first char against the periodic table.
 * Falls back to "C" if nothing matches.
 */
export function deriveElementFromType(typeName: string): string {
  if (PeriodicTable[typeName]) return typeName;
  if (typeName.length >= 2) {
    const two = typeName[0].toUpperCase() + typeName[1].toLowerCase();
    if (PeriodicTable[two]) return two;
  }
  const one = typeName[0]?.toUpperCase();
  if (one && PeriodicTable[one]) return one;
  return "C";
}

/**
 * Process a Zarr frame to ensure the `element` column exists.
 * If missing, derives it from the `type` column using periodic table lookup.
 */
export function processZarrFrame(frame: Frame): Frame {
  const atoms = frame.getBlock("atoms");
  if (!atoms) return frame;
  if (atoms.getColumnStrings("element")) return frame;
  const types = atoms.getColumnStrings("type");
  if (!types) return frame;
  const derived = types.map(deriveElementFromType);
  atoms.setColumnStrings("element", derived);
  return frame;
}

/**
 * Trajectory reader for multi-frame files (XYZ format).
 */
export class TrajectoryReader {
  private reader: XyzReader;
  private frameCount: number;

  constructor(content: string) {
    this.reader = new XyzReader(content);
    this.frameCount = this.reader.len();
  }

  getFrameCount(): number {
    return this.frameCount;
  }

  readFrame(index: number): Frame {
    if (index < 0 || index >= this.frameCount) {
      throw new Error(`Frame index ${index} out of range [0, ${this.frameCount})`);
    }

    const frame = this.reader.read(index);
    if (!frame) {
      throw new Error(`Failed to read frame ${index}`);
    }

    processXYZFrame(frame);
    return frame;
  }

  free(): void {
    this.reader.free();
  }
}
