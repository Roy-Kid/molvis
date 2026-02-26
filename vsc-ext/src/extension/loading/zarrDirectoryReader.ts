import * as vscode from "vscode";
import { readZarrDirectoryWithFs } from "./zarrDirectoryReaderCore";

export async function readZarrDirectory(
  uri: vscode.Uri,
): Promise<Record<string, string>> {
  return readZarrDirectoryWithFs(uri, vscode.workspace.fs, vscode.Uri);
}
