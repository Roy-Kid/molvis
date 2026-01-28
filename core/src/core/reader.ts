import { Frame, PdbReader, XyzReader, LammpsReader } from "molrs-wasm";

/**
 * Reads a frame from file content.
 * 
 * @param content - File content as string
 * @param format - File format ("xyz", "pdb", "lammps")
 * @returns Frame object
 */
export function readFrame(content: string, format: string): Frame {
    console.log(`[reader] readFrame called with format: ${format}, content length: ${content.length}`);

    try {
        const lower = format.toLowerCase();
        let frame: Frame | undefined;

        if (lower === 'xyz') {
            const reader = new XyzReader(content);
            frame = reader.read(0);
            reader.free();
        } else if (lower === 'pdb') {
            const reader = new PdbReader(content);
            frame = reader.read(0);
            reader.free();
        } else if (lower === 'lammps' || lower === 'lmp' || lower === 'data') {
            const reader = new LammpsReader(content);
            frame = reader.read(0);
            reader.free();
        } else {
            throw new Error(`Unsupported format: ${format}`);
        }

        if (frame) {
            console.log(`[reader] Successfully read frame with format: ${format}`);
            return frame;
        } else {
            console.warn(`[reader] Failed to read frame for format ${format}`);
            return new Frame();
        }
    } catch (e) {
        console.error("[reader] Error reading frame via WASM:", e);
        return new Frame();
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
