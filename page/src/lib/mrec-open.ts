/**
 * Browser doors onto a `*.mrec` store, resolved to the `File` handles the
 * stage ingress takes (`loadMrecSource` with an `MrecStoreInput`).
 *
 * A store directory reaches the page three ways — the File System Access
 * picker (`showDirectoryPicker`), a directory dropped onto the canvas
 * (`DataTransferItem.getAsFileSystemHandle` / `webkitGetAsEntry`), or the
 * `<input webkitdirectory>` fallback — and every one of them yields the same
 * {@link MrecDirectoryOpen}: store-relative key → `File`. Nothing is read
 * here; the trajectory worker reads exactly the byte ranges a frame touches.
 *
 * A packed `*.mrec.zip` is an ordinary `File` and needs no door of its own.
 */

import {
  isMrecZipPath,
  mrecStoreRootPath,
} from "@molcrafts/molvis-stage/io/formats";

/** A `*.mrec` directory the user opened, as `File` handles. */
export interface MrecDirectoryOpen {
  kind: "mrec-directory";
  /** Directory name (`growth.mrec`). */
  name: string;
  /** Store-relative POSIX key → `File`. */
  files: Map<string, File>;
}

/** What a page open gesture hands the loader: a file or a store directory. */
export type OpenTarget = File | MrecDirectoryOpen;

export function isMrecDirectoryOpen(
  target: OpenTarget,
): target is MrecDirectoryOpen {
  return (target as MrecDirectoryOpen).kind === "mrec-directory";
}

/** Whether a plain `File` is a packed store the mrec reader opens. */
export function isMrecZipFile(file: File): boolean {
  return isMrecZipPath(file.name);
}

// --- File System Access API (structural, so tests need no DOM lib types) ---

/** What every handle exposes before its kind is known (`FileSystemHandle`). */
export interface HandleLike {
  readonly kind: "file" | "directory";
  readonly name: string;
}

export interface FileHandleLike extends HandleLike {
  readonly kind: "file";
  getFile(): Promise<File>;
}

export interface DirectoryHandleLike extends HandleLike {
  readonly kind: "directory";
  entries(): AsyncIterable<[string, FileHandleLike | DirectoryHandleLike]>;
}

const MAX_STORE_ENTRIES = 500_000;
const MAX_STORE_DEPTH = 64;
const MAX_STORE_BYTES = 1024 * 1024 * 1024;

/** Walk a directory handle into store-relative key → `File`. */
export async function collectMrecFilesFromHandle(
  root: DirectoryHandleLike,
): Promise<Map<string, File>> {
  const files = new Map<string, File>();
  let entries = 0;
  let bytes = 0;
  const visit = async (
    dir: DirectoryHandleLike,
    prefix: string,
    depth: number,
  ): Promise<void> => {
    if (depth > MAX_STORE_DEPTH) {
      throw new Error(
        `mrec store is deeper than ${MAX_STORE_DEPTH} directories; refusing to walk it`,
      );
    }
    for await (const [name, handle] of dir.entries()) {
      if (
        name.length === 0 ||
        name === "." ||
        name === ".." ||
        name.includes("/") ||
        name.includes("\\")
      ) {
        continue;
      }
      if (++entries > MAX_STORE_ENTRIES) {
        throw new Error(
          `mrec store holds more than ${MAX_STORE_ENTRIES} entries; refusing to walk it`,
        );
      }
      const key = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === "directory") await visit(handle, key, depth + 1);
      else {
        const file = await handle.getFile();
        bytes += file.size;
        if (bytes > MAX_STORE_BYTES) {
          throw new Error(
            "mrec store exceeds 1 GB of file sizes; refusing to walk it",
          );
        }
        files.set(key, file);
      }
    }
  };
  await visit(root, "", 0);
  return files;
}

// --- Legacy drag-and-drop entries (`webkitGetAsEntry`) ---

/** What every entry exposes before its kind is known (`FileSystemEntry`). */
export interface EntryLike {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly name: string;
}

export interface FileEntryLike extends EntryLike {
  readonly isFile: true;
  readonly isDirectory: false;
  file(ok: (file: File) => void, err?: (e: unknown) => void): void;
}

export interface DirectoryEntryLike extends EntryLike {
  readonly isFile: false;
  readonly isDirectory: true;
  createReader(): {
    readEntries(
      ok: (entries: Array<FileEntryLike | DirectoryEntryLike>) => void,
      err?: (e: unknown) => void,
    ): void;
  };
}

function readAllEntries(
  dir: DirectoryEntryLike,
): Promise<Array<FileEntryLike | DirectoryEntryLike>> {
  // `readEntries` returns batches (Chromium: 100 at a time) until empty.
  const reader = dir.createReader();
  const out: Array<FileEntryLike | DirectoryEntryLike> = [];
  return new Promise((resolve, reject) => {
    const next = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(out);
          return;
        }
        out.push(...batch);
        next();
      }, reject);
    next();
  });
}

/** Walk a dropped directory entry into store-relative key → `File`. */
export async function collectMrecFilesFromEntry(
  root: DirectoryEntryLike,
): Promise<Map<string, File>> {
  const files = new Map<string, File>();
  let seen = 0;
  let bytes = 0;
  const visit = async (
    dir: DirectoryEntryLike,
    prefix: string,
    depth: number,
  ): Promise<void> => {
    if (depth > MAX_STORE_DEPTH) {
      throw new Error(
        `mrec store is deeper than ${MAX_STORE_DEPTH} directories; refusing to walk it`,
      );
    }
    for (const entry of await readAllEntries(dir)) {
      if (
        entry.name.length === 0 ||
        entry.name === "." ||
        entry.name === ".." ||
        entry.name.includes("/") ||
        entry.name.includes("\\")
      ) {
        continue;
      }
      if (++seen > MAX_STORE_ENTRIES) {
        throw new Error(
          `mrec store holds more than ${MAX_STORE_ENTRIES} entries; refusing to walk it`,
        );
      }
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory) {
        await visit(entry, key, depth + 1);
      } else {
        const file = await new Promise<File>((ok, err) => entry.file(ok, err));
        bytes += file.size;
        if (bytes > MAX_STORE_BYTES) {
          throw new Error(
            "mrec store exceeds 1 GB of file sizes; refusing to walk it",
          );
        }
        files.set(key, file);
      }
    }
  };
  await visit(root, "", 0);
  return files;
}

// --- `<input webkitdirectory>` fallback ---

/**
 * Group a directory input's files by `webkitRelativePath`
 * (`growth.mrec/trajectory/step/c/0`): the first segment is the picked
 * directory, the rest is the store key.
 */
export function mrecDirectoryFromRelativePaths(
  files: Iterable<File>,
): MrecDirectoryOpen | null {
  const map = new Map<string, File>();
  let name: string | null = null;
  for (const file of files) {
    const rel = (file as File & { webkitRelativePath?: string })
      .webkitRelativePath;
    if (!rel) continue;
    const slash = rel.indexOf("/");
    if (slash < 0) continue;
    name ??= rel.slice(0, slash);
    map.set(rel.slice(slash + 1), file);
  }
  if (name === null || map.size === 0) return null;
  return { kind: "mrec-directory", name, files: map };
}

// --- Drop resolution ---

/**
 * The slice of `DataTransferItem` the drop door reads. The DOM lib types the
 * two accessors with their base classes (`FileSystemHandle`,
 * `FileSystemEntry`); the kind flags narrow them to the sub-shapes below.
 */
interface DataTransferItemLike {
  readonly kind: string;
  getAsFileSystemHandle?(): Promise<HandleLike | null>;
  webkitGetAsEntry?(): EntryLike | null;
  getAsFile(): File | null;
}

/**
 * Resolve the first dropped item. A directory named `*.mrec` becomes an
 * {@link MrecDirectoryOpen}; a dropped directory that is not a store is
 * refused loudly (the browser would otherwise hand back a 0-byte `File`
 * for it); anything else is the plain `File`.
 */
export async function resolveDropTarget(
  item: DataTransferItemLike | undefined,
  fallbackFile: File | undefined,
): Promise<OpenTarget | null> {
  if (item?.kind !== "file") return fallbackFile ?? null;

  // Every accessor of a DataTransferItem must be called synchronously inside
  // the drop event — the item list is emptied once the handler returns — so
  // all three are read before the first await.
  const handlePromise = item.getAsFileSystemHandle?.();
  const entry = item.webkitGetAsEntry?.() ?? null;
  const plainFile = item.getAsFile();

  const handle = handlePromise ? await handlePromise.catch(() => null) : null;
  if (handle?.kind === "directory") {
    if (!mrecStoreRootPath(handle.name)) {
      throw new Error(
        `${handle.name} is a folder; only *.mrec store folders can be opened`,
      );
    }
    return {
      kind: "mrec-directory",
      name: handle.name,
      files: await collectMrecFilesFromHandle(handle as DirectoryHandleLike),
    };
  }
  if (handle?.kind === "file") return (handle as FileHandleLike).getFile();

  if (entry?.isDirectory) {
    if (!mrecStoreRootPath(entry.name)) {
      throw new Error(
        `${entry.name} is a folder; only *.mrec store folders can be opened`,
      );
    }
    return {
      kind: "mrec-directory",
      name: entry.name,
      files: await collectMrecFilesFromEntry(entry as DirectoryEntryLike),
    };
  }
  return plainFile ?? fallbackFile ?? null;
}

/**
 * Ask the user for a `*.mrec` folder. Uses `showDirectoryPicker` when the
 * browser has it and falls back to a `webkitdirectory` input. `null` on
 * cancel; a picked folder that is not a store throws.
 */
export async function pickMrecDirectory(): Promise<MrecDirectoryOpen | null> {
  const picker = (
    globalThis as {
      showDirectoryPicker?: (opts?: {
        mode?: "read";
      }) => Promise<DirectoryHandleLike>;
    }
  ).showDirectoryPicker;
  if (typeof picker === "function") {
    let handle: DirectoryHandleLike;
    try {
      handle = await picker({ mode: "read" });
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") return null;
      throw error;
    }
    if (!mrecStoreRootPath(handle.name)) {
      throw new Error(`${handle.name} is not a *.mrec store folder`);
    }
    return {
      kind: "mrec-directory",
      name: handle.name,
      files: await collectMrecFilesFromHandle(handle),
    };
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.setAttribute("webkitdirectory", "");
    input.onchange = () => {
      const picked = mrecDirectoryFromRelativePaths(input.files ?? []);
      if (!picked) {
        resolve(null);
        return;
      }
      if (!mrecStoreRootPath(picked.name)) {
        reject(new Error(`${picked.name} is not a *.mrec store folder`));
        return;
      }
      resolve(picked);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
