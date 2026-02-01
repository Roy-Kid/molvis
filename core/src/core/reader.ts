import { Frame, PdbReader, XyzReader, LammpsReader } from "molrs-wasm";
import { logger } from "../utils/logger";

/**
 * Reads a PDB frame from file content.
 * 
 * @param content - File content as string
 * @returns Frame object
 */
export function readPDBFrame(content: string): Frame {
    try {
        const reader = new PdbReader(content);
        const frame = reader.read(0);
        reader.free();

        if (!frame) throw new Error("No frame read");

        logger.info(`[reader] Successfully read PDB frame`);
        return frame;
    } catch (e) {
        logger.error("[reader] Error reading PDB frame via WASM:", e);
        return new Frame();
    }
}

/**
 * Reads an XYZ frame from file content.
 * 
 * @param content - File content as string
 * @returns Frame object
 */
export function readXYZFrame(content: string): Frame {
    try {
        const reader = new XyzReader(content);
        const frame = reader.read(0);
        reader.free();

        if (!frame) throw new Error("No frame read");

        logger.info(`[reader] Successfully read XYZ frame`);
        return frame;
    } catch (e) {
        logger.error("[reader] Error reading XYZ frame via WASM:", e);
        return new Frame();
    }
}

/**
 * Reads a LAMMPS data frame from file content.
 * 
 * @param content - File content as string
 * @returns Frame object
 */
export function readLAMMPSData(content: string): Frame {
    try {
        const reader = new LammpsReader(content);
        const frame = reader.read(0);
        reader.free();

        if (!frame) {
            throw new Error("No frame read from LAMMPS data");
        }

        // FIXME: frame.renameBlock is missing in current WASM binding
        // frame.renameBlock("species", "element");

        logger.info(`[reader] Successfully read LAMMPS data frame`);
        return frame;
    } catch (e) {
        logger.error("[reader] Error reading LAMMPS data frame via WASM:", e);
        return new Frame();
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
        case 'xyz':
            return readXYZFrame(content);
        case 'lammps':
            return readLAMMPSData(content);
        case 'pdb':
        default:
            return readPDBFrame(content);
    }
}

/**
 * Infers file format from filename extension.
 */
export function inferFormatFromFilename(
    filename: string,
    fallback: string = "pdb"
): string {
    const trimmed = filename.trim();
    const dot = trimmed.lastIndexOf(".");
    const ext = dot >= 0 ? trimmed.slice(dot + 1).toLowerCase() : "";

    if (ext === "pdb") return "pdb";
    if (ext === "xyz") return "xyz";
    if (ext === "lammps" || ext === "lmp" || ext === "data") return "lammps";

    return fallback;
}
