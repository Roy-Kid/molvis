import {
  Box,
  type Frame,
  LAMMPSReader,
  PDBReader,
  XYZReader,
} from "molrs-wasm";
import { PeriodicTable } from "./system/elements";
import { logger } from "./utils/logger";

/**
 * Parse a PDB payload into a normalized frame.
 * Normalizes element names, bond column types (i32→u32), and CRYST1 box.
 */
export function readPDBFrame(content: string): Frame {
  const reader = new PDBReader(content);
  const frame = reader.read(0);
  reader.free();

  if (!frame) {
    throw new Error("PDB reader returned null frame");
  }

  const atomBlock = frame.getBlock("atoms");
  if (!atomBlock) {
    throw new Error("PDB frame has no atoms block");
  }

  if (!atomBlock.dtype("element")) {
    const typeSymbol = atomBlock.copyColStr("type_symbol");
    if (!typeSymbol) {
      throw new Error("PDB atoms block missing 'type_symbol' column");
    }
    atomBlock.setColStr("element", typeSymbol);
  }

  // Normalize bond columns: WASM PDBReader may store i/j as i32, convert to u32
  normalizeBondColumns(frame);

  // Parse CRYST1 record for box if WASM reader didn't populate simbox
  if (!frame.simbox) {
    const box = parseCryst1(content);
    if (box) {
      frame.simbox = box;
    }
  }

  logger.info("[reader] Successfully read PDB frame");
  return frame;
}

/**
 * Convert bond i/j columns from i32 to u32 if needed.
 * The WASM PDBReader may store CONECT indices as i32 — the rendering
 * pipeline expects u32.
 */
function normalizeBondColumns(frame: Frame): void {
  const bonds = frame.getBlock("bonds");
  if (!bonds || bonds.nrows() === 0) return;

  for (const col of ["i", "j"]) {
    if (!bonds.keys().includes(col)) continue;

    const dtype = bonds.dtype(col);
    if (dtype === "u32") continue; // already u32

    if (dtype === "i32") {
      const i32 = bonds.viewColI32(col);
      if (i32) {
        bonds.setColU32(col, new Uint32Array(i32));
      }
    }
  }
}

/**
 * Parse the CRYST1 record from PDB content to extract box dimensions.
 * Format: CRYST1    a      b      c     alpha  beta   gamma sGroup
 */
function parseCryst1(content: string): Box | null {
  const line = content.split("\n").find((l) => l.startsWith("CRYST1"));
  if (!line || line.length < 54) return null;

  const a = Number.parseFloat(line.slice(6, 15));
  const b = Number.parseFloat(line.slice(15, 24));
  const c = Number.parseFloat(line.slice(24, 33));

  if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c)) return null;
  if (a <= 0 || b <= 0 || c <= 0) return null;

  const origin = new Float32Array([0, 0, 0]);

  if (a === b && b === c) {
    return Box.cube(a, origin, true, true, true);
  }
  return Box.ortho(new Float32Array([a, b, c]), origin, true, true, true);
}

function processXYZFrame(frame: Frame): void {
  const atomBlock = frame.getBlock("atoms");
  if (!atomBlock) {
    throw new Error("XYZ frame has no atoms block");
  }

  if (!atomBlock.dtype("element")) {
    const symbol = atomBlock.copyColStr("species");
    if (!symbol) {
      throw new Error("XYZ atoms block missing 'species' column");
    }
    atomBlock.setColStr("element", symbol);
  }
}

/**
 * Parse an XYZ payload into a normalized frame.
 */
export function readXYZFrame(content: string): Frame {
  const reader = new XYZReader(content);
  const frame = reader.read(0);
  reader.free();

  if (!frame) {
    throw new Error("XYZ reader returned null frame");
  }

  processXYZFrame(frame);
  logger.info("[reader] Successfully read XYZ frame");
  return frame;
}

/**
 * Parse a LAMMPS data payload into a normalized frame.
 */
export function readLAMMPSData(content: string): Frame {
  const reader = new LAMMPSReader(content);
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
  if (!atomBlock.dtype("element")) {
    const species = atomBlock.copyColStr("species");
    if (!species) {
      throw new Error("LAMMPS atoms block missing 'species' column");
    }
    atomBlock.setColStr("element", species);
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
  if (atoms.dtype("element")) return frame;
  const types = atoms.copyColStr("type");
  if (!types) return frame;
  const derived = types.map(deriveElementFromType);
  atoms.setColStr("element", derived);
  return frame;
}

/**
 * Trajectory reader for multi-frame files (XYZ format).
 */
export class TrajectoryReader {
  private reader: XYZReader;
  private frameCount: number;

  /**
   * Create a multi-frame reader for XYZ trajectory payloads.
   */
  constructor(content: string) {
    this.reader = new XYZReader(content);
    this.frameCount = this.reader.len();
  }

  /**
   * Return the number of readable frames in the source payload.
   */
  getFrameCount(): number {
    return this.frameCount;
  }

  /**
   * Read and normalize a single frame by index.
   */
  readFrame(index: number): Frame {
    if (index < 0 || index >= this.frameCount) {
      throw new Error(
        `Frame index ${index} out of range [0, ${this.frameCount})`,
      );
    }

    const frame = this.reader.read(index);
    if (!frame) {
      throw new Error(`Failed to read frame ${index}`);
    }

    processXYZFrame(frame);
    return frame;
  }

  /**
   * Release the underlying WASM reader.
   */
  free(): void {
    this.reader.free();
  }
}
