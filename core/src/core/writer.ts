import { writeFrame as wasmWriteFrame, Frame } from "molrs-wasm";

export type ExportFormat = "pdb" | "xyz" | "lammps";

export interface ExportPayload {
    format: ExportFormat | string;
    mime: string;
    suggestedName: string;
    content: string;
    warnings?: string[];
}

export interface WriteFrameOptions {
    format?: string;
    filename?: string;
    defaultFormat?: ExportFormat;
}

/**
 * Writes a frame to a string in the specified format.
 * 
 * @param frame - Frame to write
 * @param opts - Write options
 * @returns Export payload with formatted content
 */
export function writeFrame(frame: Frame, opts: WriteFrameOptions): ExportPayload {
    const warnings: string[] = [];
    const fallback = opts.defaultFormat ?? "pdb";
    const format = (opts.format || fallback).toLowerCase();

    if (!opts.format) {
        warnings.push("format-defaulted");
    }

    const suggestedName = ensureExtension(opts.filename ?? "molvis", format);

    // Call WASM writeFrame
    let content: string;
    try {
        content = wasmWriteFrame(frame, format);
    } catch (e) {
        console.warn(`[writer] WASM writeFrame not yet implemented: ${e}`);
        content = ""; // Placeholder until writeFrame is fully implemented
        warnings.push("writer-not-implemented");
    }

    return {
        format,
        mime: mimeForFormat(format),
        suggestedName,
        content,
        warnings: warnings.length ? warnings : undefined
    };
}

/**
 * Gets the default file extension for a format.
 */
export function defaultExtensionForFormat(format: string): string {
    const key = format.toLowerCase();
    if (key === "pdb") return "pdb";
    if (key === "xyz") return "xyz";
    if (key === "lammps") return "lammps";
    return key;
}

/**
 * Gets the MIME type for a format.
 */
export function mimeForFormat(format: string): string {
    const key = format.toLowerCase();
    if (key === "pdb") return "chemical/x-pdb";
    if (key === "xyz") return "chemical/x-xyz";
    if (key === "lammps") return "text/plain";
    return "text/plain";
}

/**
 * Ensures filename has the correct extension.
 */
function ensureExtension(name: string, format: string): string {
    const trimmed = name.trim();
    const hasExt = /\.[A-Za-z0-9]+$/.test(trimmed);
    if (hasExt) return trimmed;
    const ext = defaultExtensionForFormat(format);
    return `${trimmed || "molvis"}.${ext}`;
}
