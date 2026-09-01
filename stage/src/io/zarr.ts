import { type Frame, TrajectoryReader } from "@molcrafts/molvis-core/molrs";
import { Trajectory } from "../system/trajectory";
import { logger } from "../utils/logger";

const FRAME_CACHE_SIZE = 16;

export interface MrecLoadResult {
  trajectory: Trajectory;
  dispose: () => void;
}

/** One entry from a host directory listing of an mrec store. */
export interface MrecDirent {
  name: string;
  kind: "file" | "directory";
}

/**
 * Host I/O for an mrec directory store (a Zarr-v3 tree on disk).
 *
 * Paths are POSIX, relative to the store root, and never start with `/`.
 * `list("")` lists the store root. molrs `TrajectoryReader` opens the store;
 * the host only supplies bytes.
 */
export interface MrecDirectorySource {
  list(path: string): Promise<readonly MrecDirent[]>;
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
    // Do not `frame.free()` here. The async trajectory LRU already
    // refuses to: wasm-bindgen FinalizationRegistry releases the
    // wrapper, and an explicit free races `_lastRenderedFrame` /
    // SceneIndex during reverse scrub.
    cache.delete(oldest);
  }
}

function trajectoryFromReader(reader: TrajectoryReader): MrecLoadResult {
  const frameCount = reader.countFrames();
  const cache = new Map<number, Frame>();

  const provider = {
    length: frameCount,
    get(index: number): Frame {
      const cached = cache.get(index);
      if (cached) return cached;
      const frame = reader.readFrame(index);
      if (!frame) throw new Error(`mrec frame ${index} out of range`);
      if (cache.size >= FRAME_CACHE_SIZE) evictOldest(cache);
      cache.set(index, frame);
      return frame;
    },
  };

  const trajectory = Trajectory.fromProvider(provider);

  // Teardown-only free. `evictOldest` deliberately refuses to free a
  // mid-life frame (it races `_lastRenderedFrame` / SceneIndex), and this
  // closure must run only AFTER the scene has been swapped off these frames:
  // `installPrimaryTrajectory` (io/index.ts) defers the outgoing file's
  // cleanup until `replaceScene` has moved `_lastRenderedFrame` onto the
  // incoming trajectory, so by the time we free here no render can deref a
  // freed molrs handle. See `.claude/notes/molrs-handles.md`.
  const dispose = () => {
    for (const frame of cache.values()) frame.free();
    cache.clear();
    reader.free();
  };

  logger.info(`[mrec] Loaded ${frameCount} frame(s)`);
  return { trajectory, dispose };
}

/**
 * Load an mrec store already materialized as store-relative path → bytes.
 * Keys must not start with `/`. Backed by molrs `TrajectoryReader`.
 */
export function loadMrecStore(files: Map<string, Uint8Array>): MrecLoadResult {
  if (files.size === 0) {
    throw new Error("mrec store is empty");
  }
  return trajectoryFromReader(new TrajectoryReader(files));
}

/**
 * Load an mrec store (supplied as a file-path → base64 map) into a
 * lazy Trajectory backed by molrs's TrajectoryReader. The returned `dispose`
 * frees the reader and its frame cache; the io ingress calls it after
 * swapping in the next trajectory.
 */
export function loadMrecFiles(files: Record<string, string>): MrecLoadResult {
  const fileMap = new Map<string, Uint8Array>();
  for (const [filePath, contentB64] of Object.entries(files)) {
    fileMap.set(filePath, decodeBase64ToBytes(contentB64));
  }
  return loadMrecStore(fileMap);
}

/**
 * Recursively read an {@link MrecDirectorySource} into store-relative path → bytes.
 * `root` is listed first; keys are relative to that root.
 */
export async function collectMrecDirectory(
  source: MrecDirectorySource,
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
    throw new Error("mrec store is empty");
  }
  return files;
}

/**
 * Open an mrec directory source through molrs `TrajectoryReader`.
 * The host lists and reads; this function walks the tree and decodes frames.
 */
export async function loadMrecDirectory(
  source: MrecDirectorySource,
  root = "",
): Promise<MrecLoadResult> {
  return loadMrecStore(await collectMrecDirectory(source, root));
}

/**
 * @deprecated Renamed to {@link MrecLoadResult} — mrec is the product, zarr
 * the encoding. Kept for one deprecation window; will be removed.
 */
export type ZarrLoadResult = MrecLoadResult;

/**
 * @deprecated Renamed to {@link MrecDirent}. Kept for one deprecation window.
 */
export type ZarrDirent = MrecDirent;

/**
 * @deprecated Renamed to {@link MrecDirectorySource}. Kept for one deprecation
 * window.
 */
export type ZarrDirectorySource = MrecDirectorySource;

/**
 * @deprecated Renamed to {@link loadMrecStore}. Kept for one deprecation window.
 */
export const loadZarrStore = loadMrecStore;

/**
 * @deprecated Renamed to {@link loadMrecFiles}. Kept for one deprecation window.
 */
export const loadZarrFiles = loadMrecFiles;

/**
 * @deprecated Renamed to {@link collectMrecDirectory}. Kept for one deprecation
 * window.
 */
export const collectZarrDirectory = collectMrecDirectory;

/**
 * @deprecated Renamed to {@link loadMrecDirectory}. Kept for one deprecation
 * window.
 */
export const loadZarrDirectory = loadMrecDirectory;
