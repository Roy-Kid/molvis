import { FILE_FORMAT_REGISTRY } from "@molcrafts/molvis-stage/io/formats";
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

  allExts.add("zarr");
  filters["Zarr directory - .zarr"] = ["zarr"];
  filters.All = [...allExts];
  filters["All files"] = ["*"];

  return filters;
}

/**
 * Prompt the user to pick a structure / trajectory file (or Zarr folder).
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
