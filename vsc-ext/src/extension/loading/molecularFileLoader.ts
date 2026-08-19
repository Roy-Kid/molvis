import {
  type FileFormat,
  inferFormatFromFilename,
  isBinaryFormat,
} from "@molcrafts/molvis-stage/io/formats";
import * as vscode from "vscode";
import type { MolecularFilePayload } from "../../protocol";
import { decideMolecularLoadIntent } from "./molecularLoadIntent";
import { getDisplayName, isZarrUriPath } from "./pathUtils";
import { readZarrDirectoryWithFs } from "./zarrDirectoryReaderCore";

export interface LoadedMolecularFile {
  filename: string;
  payload: MolecularFilePayload;
  /** True when `payload` is raw bytes meant for the streaming worker path. */
  stream?: boolean;
  /**
   * When set, the host should send `openUri` instead of `loadFile`.
   * The payload is unused.
   */
  openUri?: {
    size: number;
    mtime: number;
  };
}

export class MolecularFileLoader {
  public async load(
    uri: vscode.Uri,
    knownFormat?: FileFormat,
  ): Promise<LoadedMolecularFile> {
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

    const filename = getDisplayName(uri);
    const format = knownFormat ?? inferFormatFromFilename(filename);
    const intent = decideMolecularLoadIntent(format ?? undefined, stat.size);
    if (intent.action === "refuse") {
      throw new Error(intent.reason);
    }
    if (intent.action === "open-uri" && uri.scheme === "file") {
      return {
        filename,
        payload: new Uint8Array(0),
        stream: true,
        openUri: { size: stat.size, mtime: stat.mtime },
      };
    }

    // Read raw bytes via the fs provider instead of `openTextDocument`, which
    // is capped at ~50MB by VSCode's TextDocument IPC. Trajectory files
    // (.lammpstrj, .dump) routinely exceed that.
    const bytes = await vscode.workspace.fs.readFile(uri);

    if (intent.action === "open-uri") {
      // Non-file scheme: still copy once, then stream in the webview.
      return { filename, payload: bytes, stream: true };
    }
    if (format && isBinaryFormat(format)) {
      return { filename, payload: bytes, stream: false };
    }

    // Small text: safe to decode (well under the string cap). BOM is consumed
    // by the decoder to match `doc.getText()` behavior.
    return {
      filename,
      payload: new TextDecoder("utf-8").decode(bytes),
      stream: false,
    };
  }
}
