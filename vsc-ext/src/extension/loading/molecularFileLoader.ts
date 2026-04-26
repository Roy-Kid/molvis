import * as vscode from "vscode";
import type { MolecularFilePayload } from "../types";
import { getDisplayName, isZarrUriPath } from "./pathUtils";
import { readZarrDirectoryWithFs } from "./zarrDirectoryReaderCore";

export interface LoadedMolecularFile {
  filename: string;
  payload: MolecularFilePayload;
}

export class MolecularFileLoader {
  public async load(uri: vscode.Uri): Promise<LoadedMolecularFile> {
    const stat = await vscode.workspace.fs.stat(uri);

    if (isZarrUriPath(uri, stat.type)) {
      return {
        filename: getDisplayName(uri),
        payload: await readZarrDirectoryWithFs(
          uri,
          vscode.workspace.fs,
          vscode.Uri,
        ),
      };
    }

    // Read raw bytes via the fs provider instead of `openTextDocument`, which
    // is capped at ~50MB by VSCode's TextDocument IPC. Trajectory files
    // (.lammpstrj, .dump) routinely exceed that. BOM is consumed by the
    // decoder to match `doc.getText()` behavior.
    const bytes = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder("utf-8").decode(bytes);
    return {
      filename: getDisplayName(uri),
      payload: text,
    };
  }
}
