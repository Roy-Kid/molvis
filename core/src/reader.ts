import {
  Box,
  type Frame,
  LAMMPSReader,
  PDBReader,
  XYZReader,
} from "@molcrafts/molrs";
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

  // Normalize column names (type_symbol→element, i/j→atomi/atomj, i32→u32)
  normalizeFrame(frame);

  const atomBlock = frame.getBlock("atoms");
  if (!atomBlock) {
    throw new Error("PDB frame has no atoms block");
  }

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
 * Canonical column name aliases produced by molrs WASM readers.
 * Maps non-canonical names to the molpy canonical equivalents.
 */
const BOND_COLUMN_ALIASES: Record<string, string> = {
  i: "atomi",
  j: "atomj",
  k: "atomk",
  l: "atoml",
  atom_i: "atomi",
  atom_j: "atomj",
  atom_k: "atomk",
  atom_l: "atoml",
};

const ATOM_COLUMN_ALIASES: Record<string, string> = {
  symbol: "element",
  species: "element",
  type_symbol: "element",
};

/**
 * Normalize a Frame's column names to molpy canonical form.
 *
 * - Renames bond index columns (``i``/``j`` or ``atom_i``/``atom_j`` → ``atomi``/``atomj``)
 * - Renames atom identity columns (``symbol``/``species`` → ``element``)
 * - Converts bond column dtype from i32 → u32 when needed
 */
function normalizeFrame(frame: Frame): void {
  normalizeBlockColumns(frame, "atoms", ATOM_COLUMN_ALIASES);
  normalizeBlockColumns(frame, "bonds", BOND_COLUMN_ALIASES);
  normalizeBlockColumns(frame, "angles", BOND_COLUMN_ALIASES);
  normalizeBlockColumns(frame, "dihedrals", BOND_COLUMN_ALIASES);

  // Ensure bond index columns are stored as u32 (WASM PDBReader may use i32)
  const bonds = frame.getBlock("bonds");
  if (!bonds || bonds.nrows() === 0) return;
  for (const col of ["atomi", "atomj"]) {
    if (bonds.dtype(col) === "i32") {
      const i32 = bonds.viewColI32(col);
      if (i32) bonds.setColU32(col, new Uint32Array(i32));
    }
  }

  // Ensure bond order column is u32 (readers may produce f32 or i32)
  const orderDtype = bonds.dtype("order");
  if (orderDtype && orderDtype !== "u32") {
    const nrows = bonds.nrows();
    if (orderDtype === "f32") {
      const f32 = bonds.viewColF32("order");
      if (f32) {
        const u32 = new Uint32Array(nrows);
        for (let i = 0; i < nrows; i++) {
          u32[i] = Math.max(1, Math.round(f32[i]));
        }
        bonds.setColU32("order", u32);
      }
    } else if (orderDtype === "i32") {
      const i32 = bonds.viewColI32("order");
      if (i32) {
        const u32 = new Uint32Array(nrows);
        for (let i = 0; i < nrows; i++) {
          u32[i] = Math.max(1, i32[i]);
        }
        bonds.setColU32("order", u32);
      }
    }
  }
}

/**
 * Rename non-canonical columns in a single block using an alias map.
 * Skips renaming if the canonical column already exists.
 */
function normalizeBlockColumns(
  frame: Frame,
  blockName: string,
  aliases: Record<string, string>,
): void {
  const block = frame.getBlock(blockName);
  if (!block) return;

  const keys = block.keys();
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (keys.includes(alias) && !keys.includes(canonical)) {
      block.renameColumn(alias, canonical);
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
  normalizeFrame(frame);

  const atomBlock = frame.getBlock("atoms");
  if (!atomBlock) {
    throw new Error("XYZ frame has no atoms block");
  }

  // After normalizeFrame, "species" is already renamed to "element".
  // If still missing, derive from "type".
  if (!atomBlock.dtype("element")) {
    const types = atomBlock.copyColStr("type");
    if (types) {
      const derived = types.map(deriveElementFromType);
      atomBlock.setColStr("element", derived);
    }
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

  normalizeFrame(frame);

  const atomBlock = frame.getBlock("atoms");
  if (!atomBlock) {
    throw new Error("LAMMPS frame has no atoms block");
  }

  // After normalizeFrame, "species" is already renamed to "element".
  // If still missing, derive from "type".
  if (!atomBlock.dtype("element")) {
    const types = atomBlock.copyColStr("type");
    if (types) {
      const derived = types.map(deriveElementFromType);
      atomBlock.setColStr("element", derived);
    }
  }

  logger.info("[reader] Successfully read LAMMPS data frame");
  return frame;
}

/**
 * Parse a LAMMPS dump payload into a normalized frame (first timestep).
 */
export function readLAMMPSDump(content: string): Frame {
  throw new Error(
    "LAMMPS dump reading is not available in the current @molcrafts/molrs build.",
  );
}

/**
 * Normalize a LAMMPS dump frame: ensure `element` column exists.
 * LAMMPS dump columns depend on the dump command; commonly `id`, `type`, `x`, `y`, `z`.
 * We derive element from `type` if `element` is missing.
 */
function processLAMMPSDumpFrame(frame: Frame): void {
  normalizeFrame(frame);

  const atoms = frame.getBlock("atoms");
  if (!atoms) {
    throw new Error("LAMMPS dump frame has no atoms block");
  }

  // After normalizeFrame, "species" is already renamed to "element".
  // If still missing, derive from "type".
  if (!atoms.dtype("element")) {
    const types = atoms.copyColStr("type");
    if (types) {
      const derived = types.map(deriveElementFromType);
      atoms.setColStr("element", derived);
    }
  }
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
    case "lammps-dump":
      return readLAMMPSDump(content);
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
  if (ext === "dump" || ext === "lammpstrj") return "lammps-dump";

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
  normalizeFrame(frame);
  const atoms = frame.getBlock("atoms");
  if (!atoms) return frame;
  if (atoms.dtype("element")) return frame;
  const types = atoms.copyColStr("type");
  if (!types) return frame;
  const derived = types.map(deriveElementFromType);
  atoms.setColStr("element", derived);
  return frame;
}

/** Common interface for multi-frame WASM readers. */
interface MultiFrameReader {
  len(): number;
  read(step: number): Frame | undefined;
  free(): void;
}

/**
 * Trajectory reader for multi-frame files.
 * Supports XYZ and LAMMPS dump formats.
 */
export class TrajectoryReader {
  private reader: MultiFrameReader;
  private frameCount: number;
  private postProcess: (frame: Frame) => void;

  constructor(content: string, format?: string) {
    const fmt = format ?? "xyz";
    if (fmt === "lammps-dump") {
      throw new Error(
        "LAMMPS dump trajectories are not available in the current @molcrafts/molrs build.",
      );
    }
    this.reader = new XYZReader(content);
    this.postProcess = processXYZFrame;
    this.frameCount = this.reader.len();
  }

  getFrameCount(): number {
    return this.frameCount;
  }

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

    this.postProcess(frame);
    return frame;
  }

  free(): void {
    this.reader.free();
  }
}
