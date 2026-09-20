import {
  FILE_FORMAT_REGISTRY,
  MREC_DIR_SUFFIX,
  MREC_ZIP_SUFFIX,
} from "@molcrafts/molvis-stage/io/formats";
import * as vscode from "vscode";
import { FORMAT_MENU, formatMenuLabel } from "./formatMenu";

/**
 * Open-dialog filters: `Software kind - .ext` names.
 * Filter values still include every registry alias so `.ent` / `.extxyz`
 * stay visible under the matching row.
 */
export function molecularOpenDialogFilters(): {
  [name: string]: string[];
} {
  const allExts = new Set<string>();
  const filters: { [name: string]: string[] } = {};

  for (const entry of FORMAT_MENU) {
    const registry = FILE_FORMAT_REGISTRY.find(
      (d) => d.format === entry.format,
    );
    const exts = registry
      ? [...registry.extensions]
      : entry.suffixes.map((s) => (s.startsWith(".") ? s.slice(1) : s));
    filters[formatMenuLabel(entry)] = exts;
    for (const ext of exts) allExts.add(ext);
  }

  // Directory-store suffix comes from the single source in stage/io/formats.
  const mrecExt = MREC_DIR_SUFFIX.replace(/^\./, "");
  allExts.add(mrecExt);
  filters[`mrec directory - ${MREC_DIR_SUFFIX}`] = [mrecExt];
  // Packed store. Dialog filters take a bare extension, so the archive row
  // matches every zip; the loader then checks the full `.mrec.zip` name.
  allExts.add("zip");
  filters[`mrec archive - ${MREC_ZIP_SUFFIX}`] = ["zip"];
  filters.All = [...allExts];
  filters["All files"] = ["*"];

  return filters;
}

/**
 * Prompt the user to pick a structure / trajectory file (or mrec folder).
 * Returns `undefined` if the dialog is cancelled.
 */
export async function pickMolecularUri(): Promise<vscode.Uri | undefined> {
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Open",
    title: "Open",
    filters: molecularOpenDialogFilters(),
  });
  return picked?.[0];
}
