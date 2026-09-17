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
const MREC_ZIP_SUFFIX = ".mrec.zip";
const STL_SUFFIX = ".stl";

/** Scheme the workbench uses for files that live on a remote authority. */
const REMOTE_SCHEME = "vscode-remote";

export function getDisplayName(uri: vscode.Uri): string {
  return path.basename(uri.fsPath) || "unknown";
}

/**
 * Rewrite a workbench `vscode-remote:` URI to the `file:` URI the extension
 * host sees for the same bytes.
 *
 * A drag out of the Explorer carries the URI as the *workbench* names it. In
 * a remote window (SSH, WSL, dev container) that is
 * `vscode-remote://<kind>+<host>/path`, while the extension host — running on
 * that very authority — reaches the same file as `file:///path`. Pass
 * `vscode.env.remoteName` as `remoteName`; a window has exactly one remote
 * authority, so an authority of that kind is this host. Any other kind, and
 * any other scheme, is returned untouched so the caller still rejects what it
 * genuinely cannot read.
 */
export function localizeRemoteUri(
  uri: vscode.Uri,
  remoteName: string | undefined,
): vscode.Uri {
  if (uri.scheme !== REMOTE_SCHEME || !remoteName) return uri;
  const kind = uri.authority.split("+")[0];
  if (kind.toLowerCase() !== remoteName.toLowerCase()) return uri;
  return uri.with({ scheme: "file", authority: "" });
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

/**
 * Whether `filePath` is a packed mrec store (`*.mrec.zip`) — a file, opened
 * by the same reader as the directory form. Mirror of `isMrecZipPath` in
 * `@molcrafts/molvis-stage/io/formats`.
 */
export function isMrecZipPath(filePath: string): boolean {
  return filePath.trim().toLowerCase().endsWith(MREC_ZIP_SUFFIX);
}

/**
 * Whether `filePath` is an STL triangle mesh — scene geometry, opened by
 * `loadMeshOverlay` rather than by a format parser, so it bypasses the format
 * picker the way an mrec store does. Mirror of `isStlPath` in
 * `@molcrafts/molvis-stage/io/formats`.
 */
export function isStlPath(filePath: string): boolean {
  return filePath.trim().toLowerCase().endsWith(STL_SUFFIX);
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
