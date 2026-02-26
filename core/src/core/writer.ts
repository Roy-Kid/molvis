import { Frame, writeFrame as wasmWriteFrame } from "@molcrafts/molrs";
import { logger } from "../utils/logger";
import { inferFormatFromFilename } from "./reader";
import { syncSceneToFrame } from "./scene_sync";
import type { SceneIndex } from "./scene_index";

export type ExportFormat = "pdb" | "xyz" | "lammps";

export interface WriteFrameOptions {
  format?: string;
  filename?: string;
}

export interface ExportPayload {
  content: string;
  mime: string;
  suggestedName: string;
}

/**
 * Build export payload from the current staged scene state without mutating save-state flags.
 */
export function exportFrame(
  sceneIndex: SceneIndex,
  options: WriteFrameOptions,
): ExportPayload {
  const frame = new Frame();
  syncSceneToFrame(sceneIndex, frame, { markSaved: false });
  return writeFrame(frame, options);
}

export function defaultExtensionForFormat(format: string): string {
  switch (format.toLowerCase()) {
    case "pdb":
      return "pdb";
    case "xyz":
      return "xyz";
    case "lammps":
      return "lammps";
    default:
      return "txt";
  }
}

export function mimeForFormat(format: string): string {
  switch (format.toLowerCase()) {
    case "pdb":
      return "chemical/x-pdb";
    case "xyz":
      return "chemical/x-xyz";
    case "lammps":
      return "text/plain";
    default:
      return "text/plain";
  }
}

/**
 * Writes a frame to a string/blob in the specified format.
 * Uses WASM writer implementation.
 */
export function writeFrame(
  frame: Frame,
  options: WriteFrameOptions,
): ExportPayload {
  let format = options.format;
  let filename = options.filename || "structure";

  if (!format && filename) {
    format = inferFormatFromFilename(filename);
  }

  if (!format) {
    format = "pdb";
  }

  // Ensure format is supported by WASM (pdb, xyz)
  const supported = ["pdb", "xyz"];
  if (!supported.includes(format.toLowerCase())) {
    // Fallback or error?
    // Since we are dispatching to WASM, we should let it handle it or fail gracefully.
    // However, we need to return payload.
    // If lammps is requested, we should probably fail.
    if (format === "lammps") {
      throw new Error("LAMMPS export not yet supported by WASM writer");
    }
  }

  try {
    const content = wasmWriteFrame(frame, format);
    const mime = mimeForFormat(format);

    // Ensure filename has correct extension
    const ext = defaultExtensionForFormat(format);
    if (!filename.toLowerCase().endsWith(`.${ext}`)) {
      filename = `${filename}.${ext}`;
    }

    logger.info(
      `[writer] Successfully wrote ${format} frame (${content.length} bytes)`,
    );

    return {
      content,
      mime,
      suggestedName: filename,
    };
  } catch (e) {
    logger.error(`[writer] Error writing ${format} frame via WASM:`, e);
    throw e;
  }
}

/**
 * Writes a PDB frame.
 */
export function writePDBFrame(frame: Frame): string {
  try {
    const content = wasmWriteFrame(frame, "pdb");
    return content;
  } catch (e) {
    logger.error("[writer] Error writing PDB frame via WASM:", e);
    throw e;
  }
}

/**
 * Writes an XYZ frame.
 */
export function writeXYZFrame(frame: Frame): string {
  try {
    const content = wasmWriteFrame(frame, "xyz");
    return content;
  } catch (e) {
    logger.error("[writer] Error writing XYZ frame via WASM:", e);
    throw e;
  }
}

/**
 * Writes a LAMMPS data frame.
 * Currently unsupported by WASM writer.
 */
export function writeLAMMPSData(_frame: Frame): string {
  throw new Error("LAMMPS export not yet supported by WASM writer");
}
