/**
 * Three-tier placement for a MolRS `.molidx` cache on the extension host.
 *
 * 1. sibling `<file>.molidx`
 * 2. workspace / global storage
 * 3. `"none"` — do not write the laptop OPFS
 */

import {
  type CachedIndex,
  type CachedIndexInput,
  decodeMolidx,
  encodeMolidx,
} from "@molcrafts/molvis-stage/io";

export type RemoteIndexPlacement = "sibling" | "cache" | "none";

export interface RemoteIndexFs {
  readFile(uri: string): Promise<Uint8Array>;
  writeFile(uri: string, data: Uint8Array): Promise<void>;
}

export class RemoteIndexStore {
  constructor(
    private readonly fs: RemoteIndexFs,
    private readonly cacheRoot: string | null,
  ) {}

  siblingUri(sourceUri: string): string {
    return `${sourceUri}.molidx`;
  }

  cacheUri(filename: string): string | null {
    if (!this.cacheRoot) return null;
    const leaf = filename.split("/").pop() ?? filename;
    return `${this.cacheRoot.replace(/\/$/, "")}/${leaf}.molidx`;
  }

  async load(
    sourceUri: string,
    filename: string,
  ): Promise<{ index: CachedIndex; placement: RemoteIndexPlacement } | null> {
    const sibling = this.siblingUri(sourceUri);
    const cached = this.cacheUri(filename);
    for (const [uri, placement] of [
      [sibling, "sibling"],
      [cached, "cache"],
    ] as const) {
      if (!uri) continue;
      try {
        const bytes = await this.fs.readFile(uri);
        const index = decodeMolidx(bytes.buffer as ArrayBuffer);
        if (index) return { index, placement };
      } catch {
        // miss
      }
    }
    return null;
  }

  async save(
    sourceUri: string,
    filename: string,
    input: CachedIndexInput,
  ): Promise<RemoteIndexPlacement> {
    const bytes = new Uint8Array(encodeMolidx(input));
    try {
      await this.fs.writeFile(this.siblingUri(sourceUri), bytes);
      return "sibling";
    } catch {
      // fall through
    }
    const cache = this.cacheUri(filename);
    if (cache) {
      try {
        await this.fs.writeFile(cache, bytes);
        return "cache";
      } catch {
        // fall through
      }
    }
    return "none";
  }
}
