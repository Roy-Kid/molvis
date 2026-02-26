export const FILE_TYPE_FILE = 1;
export const FILE_TYPE_DIRECTORY = 2;

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
 */
export async function readZarrDirectoryWithFs<TUri extends UriLike>(
  uri: TUri,
  fs: FileSystemLike<TUri>,
  uriHelpers: UriHelpers<TUri>,
  toBase64: Base64Encoder = encodeBase64,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  async function visit(
    directoryUri: TUri,
    relativePath: string,
  ): Promise<void> {
    const entries = await fs.readDirectory(directoryUri);
    for (const [name, type] of entries) {
      const entryUri = uriHelpers.joinPath(directoryUri, name);
      const entryPath = relativePath ? `${relativePath}/${name}` : name;

      if ((type & FILE_TYPE_DIRECTORY) !== 0) {
        await visit(entryUri, entryPath);
      } else if ((type & FILE_TYPE_FILE) !== 0) {
        const content = await fs.readFile(entryUri);
        files[entryPath] = toBase64(content);
      }
    }
  }

  await visit(uri, "");
  return files;
}
