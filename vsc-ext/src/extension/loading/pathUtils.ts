import * as path from "node:path";
import type * as vscode from "vscode";
import { FILE_TYPE_DIRECTORY } from "./zarrDirectoryReaderCore";

export function getDisplayName(uri: vscode.Uri): string {
  return path.basename(uri.fsPath) || "unknown";
}

export function isZarrUriPath(uri: vscode.Uri, type: number): boolean {
  const isDirectory = (type & FILE_TYPE_DIRECTORY) !== 0;
  return (
    isDirectory && (uri.path.endsWith(".zarr") || uri.path.endsWith(".zarr/"))
  );
}
