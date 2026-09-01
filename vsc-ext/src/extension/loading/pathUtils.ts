import * as path from "node:path";
import type * as vscode from "vscode";
import { FILE_TYPE_DIRECTORY } from "./zarrDirectoryReaderCore";

// Canonical spec for the `.mrec` store-root rule lives in
// `@molcrafts/molvis-stage/io/formats` (`MREC_DIR_SUFFIX` / `mrecStoreRootPath`).
// It is re-implemented here rather than imported because this module is
// compiled and run as CommonJS by the mocha unit runner, which cannot `require`
// the ESM stage package (TS1479) — the same constraint that keeps
// `molecularMatch`'s extension list local. Keep this in lockstep with stage.
const MREC_DIR_SUFFIX = ".mrec";

export function getDisplayName(uri: vscode.Uri): string {
  return path.basename(uri.fsPath) || "unknown";
}

/**
 * Store root of a `*.mrec` directory record, or `undefined`.
 *
 * Accepts the store itself (`growth.mrec`) and any path inside it
 * (`growth.mrec/zarr.json`, `growth.mrec/trajectory/atoms/x/c/0`). Packed
 * `*.mrec.zip` archives are files, not this door.
 *
 * Mirror of `mrecStoreRootPath` in `@molcrafts/molvis-stage/io/formats`.
 */
export function mrecStoreRootPath(filePath: string): string | undefined {
  const posix = filePath.replaceAll("\\", "/");
  const trimmed =
    posix.length > 1 && posix.endsWith("/") ? posix.slice(0, -1) : posix;
  const lower = trimmed.toLowerCase();
  const insideMarker = `${MREC_DIR_SUFFIX}/`;
  const inside = lower.lastIndexOf(insideMarker);
  if (inside >= 0) {
    return trimmed.slice(0, inside + MREC_DIR_SUFFIX.length);
  }
  if (lower.endsWith(MREC_DIR_SUFFIX)) {
    return trimmed;
  }
  return undefined;
}

/** Point any path inside a `*.mrec` directory at the store root. */
export function collapseMrecStoreUri(uri: vscode.Uri): vscode.Uri {
  const root = mrecStoreRootPath(uri.path);
  if (!root || root === uri.path) return uri;
  return uri.with({ path: root });
}

export function isMrecUriPath(uri: vscode.Uri, type: number): boolean {
  const isDirectory = (type & FILE_TYPE_DIRECTORY) !== 0;
  if (!isDirectory) return false;
  const root = mrecStoreRootPath(uri.path);
  return root !== undefined && (root === uri.path || `${root}/` === uri.path);
}
