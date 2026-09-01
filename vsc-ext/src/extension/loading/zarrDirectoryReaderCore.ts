export const FILE_TYPE_FILE = 1;
export const FILE_TYPE_DIRECTORY = 2;
/** VS Code `FileType.SymbolicLink` — OR'd into the File/Directory bits. */
export const FILE_TYPE_SYMLINK = 64;

/**
 * Hard ceilings so a hostile or pathological store cannot exhaust the
 * extension host: a store that walks past any of these is refused, not read.
 */
export const DEFAULT_MAX_STORE_BYTES = 1024 * 1024 * 1024;
export const DEFAULT_MAX_STORE_ENTRIES = 500_000;
export const DEFAULT_MAX_STORE_DEPTH = 64;

export interface ZarrDirectoryReadLimits {
  /** Refuse once the summed file bytes exceed this. */
  maxTotalBytes?: number;
  /** Refuse once this many files/directories have been visited. */
  maxEntries?: number;
  /** Refuse once recursion is this deep. */
  maxDepth?: number;
}

export interface FileSystemLike<TUri> {
  readDirectory(uri: TUri): PromiseLike<Array<[string, number]>>;
  readFile(uri: TUri): PromiseLike<Uint8Array>;
}

export interface UriLike {
  path: string;
}

export interface UriHelpers<TUri> {
  joinPath(base: TUri, ...pathSegments: string[]): TUri;
}

export type Base64Encoder = (value: Uint8Array) => string;

export function encodeBase64(value: Uint8Array): string {
  return Buffer.from(value).toString("base64");
}

/**
 * Recursively read a Zarr directory and return relative path -> base64 content.
 * Keys do not start with '/'.
 *
 * Symlinked entries are refused rather than followed: a store is
 * attacker-supplied, and a link such as `atoms/x -> /home/user/.ssh` would
 * otherwise be read wholesale into the returned payload. The byte/entry/depth
 * budgets bound a store that is merely huge or self-referential.
 */
export async function readZarrDirectoryWithFs<TUri extends UriLike>(
  uri: TUri,
  fs: FileSystemLike<TUri>,
  uriHelpers: UriHelpers<TUri>,
  toBase64: Base64Encoder = encodeBase64,
  limits: ZarrDirectoryReadLimits = {},
): Promise<Record<string, string>> {
  const maxTotalBytes = limits.maxTotalBytes ?? DEFAULT_MAX_STORE_BYTES;
  const maxEntries = limits.maxEntries ?? DEFAULT_MAX_STORE_ENTRIES;
  const maxDepth = limits.maxDepth ?? DEFAULT_MAX_STORE_DEPTH;

  const files: Record<string, string> = {};
  let totalBytes = 0;
  let entryCount = 0;

  async function visit(
    directoryUri: TUri,
    relativePath: string,
    depth: number,
  ): Promise<void> {
    if (depth > maxDepth) {
      throw new Error(
        `Zarr store nests deeper than ${maxDepth} levels; refusing to read`,
      );
    }
    const entries = await fs.readDirectory(directoryUri);
    for (const [name, type] of entries) {
      if ((type & FILE_TYPE_SYMLINK) !== 0) {
        // Never follow a link out of the store root.
        continue;
      }
      if (++entryCount > maxEntries) {
        throw new Error(
          `Zarr store holds more than ${maxEntries} entries; refusing to read`,
        );
      }
      const entryUri = uriHelpers.joinPath(directoryUri, name);
      const entryPath = relativePath ? `${relativePath}/${name}` : name;

      if ((type & FILE_TYPE_DIRECTORY) !== 0) {
        await visit(entryUri, entryPath, depth + 1);
      } else if ((type & FILE_TYPE_FILE) !== 0) {
        const content = await fs.readFile(entryUri);
        totalBytes += content.byteLength;
        if (totalBytes > maxTotalBytes) {
          throw new Error(
            `Zarr store exceeds ${(maxTotalBytes / (1024 * 1024)).toFixed(0)} MB; refusing to read the whole store into memory`,
          );
        }
        files[entryPath] = toBase64(content);
      }
    }
  }

  await visit(uri, "", 0);
  return files;
}
