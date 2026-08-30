import { type Frame, TrajectoryReader } from "@molcrafts/molvis-core/molrs";
import { Trajectory } from "../system/trajectory";
import { logger } from "../utils/logger";

const FRAME_CACHE_SIZE = 16;

export interface ZarrLoadResult {
  trajectory: Trajectory;
  dispose: () => void;
}

/** One entry from a host directory listing of a Zarr store. */
export interface ZarrDirent {
  name: string;
  kind: "file" | "directory";
}

/**
 * Host I/O for a Zarr V3 directory store.
 *
 * Paths are POSIX, relative to the store root, and never start with `/`.
 * `list("")` lists the store root. molrs `TrajectoryReader` opens the store;
 * the host only supplies bytes.
 */
export interface ZarrDirectorySource {
  list(path: string): Promise<readonly ZarrDirent[]>;
  read(path: string): Promise<Uint8Array>;
}

function decodeBase64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function joinStorePath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

function storeRelativeKey(path: string, root: string): string {
  if (!root) return path;
  if (path === root) return "";
  const prefix = `${root}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function evictOldest(cache: Map<number, Frame>): void {
  const oldest = cache.keys().next().value as number | undefined;
  if (oldest !== undefined) {
    cache.get(oldest)?.free();
    cache.delete(oldest);
  }
}

function trajectoryFromReader(reader: TrajectoryReader): ZarrLoadResult {
  const frameCount = reader.countFrames();
  const cache = new Map<number, Frame>();

  const provider = {
    length: frameCount,
    get(index: number): Frame {
      const cached = cache.get(index);
      if (cached) return cached;
      const frame = reader.readFrame(index);
      if (!frame) throw new Error(`Zarr frame ${index} out of range`);
      if (cache.size >= FRAME_CACHE_SIZE) evictOldest(cache);
      cache.set(index, frame);
      return frame;
    },
  };

  const trajectory = Trajectory.fromProvider(provider);

  const dispose = () => {
    for (const frame of cache.values()) frame.free();
    cache.clear();
    reader.free();
  };

  logger.info(`[zarr] Loaded ${frameCount} frame(s)`);
  return { trajectory, dispose };
}

/**
 * Load a zarr directory already materialized as store-relative path → bytes.
 * Keys must not start with `/`. Backed by molrs `TrajectoryReader`.
 */
export function loadZarrStore(files: Map<string, Uint8Array>): ZarrLoadResult {
  if (files.size === 0) {
    throw new Error("Zarr store is empty");
  }
  return trajectoryFromReader(new TrajectoryReader(files));
}

/**
 * Load a zarr directory (supplied as a file-path → base64 map) into a
 * lazy Trajectory backed by molrs's TrajectoryReader. The returned `dispose`
 * frees the reader and its frame cache; the io ingress calls it before
 * swapping in the next trajectory.
 */
export function loadZarrFiles(files: Record<string, string>): ZarrLoadResult {
  const fileMap = new Map<string, Uint8Array>();
  for (const [filePath, contentB64] of Object.entries(files)) {
    fileMap.set(filePath, decodeBase64ToBytes(contentB64));
  }
  return loadZarrStore(fileMap);
}

/**
 * Recursively read a {@link ZarrDirectorySource} into store-relative path → bytes.
 * `root` is listed first; keys are relative to that root.
 */
export async function collectZarrDirectory(
  source: ZarrDirectorySource,
  root = "",
): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();

  const visit = async (rel: string): Promise<void> => {
    const entries = await source.list(rel);
    for (const entry of entries) {
      const path = joinStorePath(rel, entry.name);
      if (entry.kind === "directory") {
        await visit(path);
        continue;
      }
      const key = storeRelativeKey(path, root);
      if (!key) continue;
      files.set(key, await source.read(path));
    }
  };

  await visit(root);
  if (files.size === 0) {
    throw new Error("Zarr store is empty");
  }
  return files;
}

/**
 * Open a Zarr V3 directory source through molrs `TrajectoryReader`.
 * The host lists and reads; this function walks the tree and decodes frames.
 */
export async function loadZarrDirectory(
  source: ZarrDirectorySource,
  root = "",
): Promise<ZarrLoadResult> {
  return loadZarrStore(await collectZarrDirectory(source, root));
}
