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
        payload: await readZarrDirectoryWithFs(uri, vscode.workspace.fs, vscode.Uri),
      };
    }

    const doc = await vscode.workspace.openTextDocument(uri);
    return {
      filename: getDisplayName(uri),
      payload: doc.getText(),
    };
  }
}
