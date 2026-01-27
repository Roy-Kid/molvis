import { write_frame, type Frame } from "molrs-wasm";

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

export type FrameWriter = (frame: Frame, format: string) => string;

export function inferFormatFromFilename(
    filename: string,
    fallback: ExportFormat = "pdb"
): ExportFormat | string {
    const trimmed = filename.trim();
    const dot = trimmed.lastIndexOf(".");
    const ext = dot >= 0 ? trimmed.slice(dot + 1).toLowerCase() : "";
    if (ext === "pdb") return "pdb";
    if (ext === "xyz") return "xyz";
    if (ext === "lammps" || ext === "lmp" || ext === "data") return "lammps";
    return fallback;
}

export function defaultExtensionForFormat(format: string): string {
    const key = format.toLowerCase();
    if (key === "pdb") return "pdb";
    if (key === "xyz") return "xyz";
    if (key === "lammps") return "lammps";
    return key;
}

export function mimeForFormat(format: string): string {
    const key = format.toLowerCase();
    if (key === "pdb") return "chemical/x-pdb";
    if (key === "xyz") return "chemical/x-xyz";
    if (key === "lammps") return "text/plain";
    return "text/plain";
}

function ensureExtension(name: string, format: string): string {
    const trimmed = name.trim();
    const hasExt = /\.[A-Za-z0-9]+$/.test(trimmed);
    if (hasExt) return trimmed;
    const ext = defaultExtensionForFormat(format);
    return `${trimmed || "molvis"}.${ext}`;
}

export function buildExportPayload(
    frame: Frame,
    opts: WriteFrameOptions,
    writer: FrameWriter = write_frame
): ExportPayload {
    const warnings: string[] = [];
    const fallback = opts.defaultFormat ?? "pdb";
    const format = (opts.format || fallback).toLowerCase();
    if (!opts.format) {
        warnings.push("format-defaulted");
    }
    const suggestedName = ensureExtension(opts.filename ?? "molvis", format);
    return {
        format,
        mime: mimeForFormat(format),
        suggestedName,
        content: writer(frame, format),
        warnings: warnings.length ? warnings : undefined
    };
}

export function writeFrame(frame: Frame, opts: WriteFrameOptions): ExportPayload {
    return buildExportPayload(frame, opts, write_frame);
}

export const serializeFrame = writeFrame;
