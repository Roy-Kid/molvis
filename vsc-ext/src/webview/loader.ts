import {
  type Box,
  type Frame,
  type FrameProvider,
  MolRecReader,
  Trajectory,
  TrajectoryReader,
  type ZarrReader,
  inferFormatFromFilename,
  processZarrFrame,
  readFrame,
} from "@molvis/core";
import type { MolecularFilePayload } from "../extension/types";

export interface RuntimeLoadContext {
  setTrajectory: (trajectory: Trajectory) => void;
  setViewMode: () => void;
  resetCamera: () => void;
  /** Load a PDB file using MolvisApp.loadPdb (builds ribbon geometry). */
  loadPdb?: (pdbText: string) => void;
}

export interface RuntimeResources {
  trajectoryReader: TrajectoryReader | null;
  zarrReader: ZarrReader | MolRecReader | null;
  boxes: Array<Box | undefined>;
  frameCache: Map<number, Frame>;
  ownedFrames: Frame[];
}

export function createRuntimeResources(): RuntimeResources {
  return {
    trajectoryReader: null,
    zarrReader: null,
    boxes: [],
    frameCache: new Map(),
    ownedFrames: [],
  };
}

/** Formats that support multi-frame trajectories. */
const TRAJECTORY_FORMATS = new Set(["xyz", "lammps-dump"]);

function isTrajectoryFile(filename: string): boolean {
  const format = inferFormatFromFilename(filename);
  return TRAJECTORY_FORMATS.has(format);
}

function isPDBFile(filename: string): boolean {
  return filename.toLowerCase().endsWith(".pdb");
}

function decodeBase64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function freeRuntimeResources(resources: RuntimeResources): void {
  for (const frame of resources.frameCache.values()) {
    frame.free();
  }
  resources.frameCache.clear();

  for (const frame of resources.ownedFrames) {
    frame.free();
  }
  resources.ownedFrames = [];

  if (resources.zarrReader) {
    resources.zarrReader.free();
    resources.zarrReader = null;
  }
  if (resources.trajectoryReader) {
    resources.trajectoryReader.free();
    resources.trajectoryReader = null;
  }
  for (const box of resources.boxes) {
    box?.free();
  }
  resources.boxes = [];
}

const FRAME_CACHE_SIZE = 16;

/**
 * Evict the oldest entry from a frame cache, freeing the WASM Frame.
 * Assumes the Artist has already consumed any previously-returned frame
 * synchronously — there is no pinning for the frame currently on-screen.
 */
function evictOldest(cache: Map<number, Frame>): void {
  const oldest = cache.keys().next().value as number | undefined;
  if (oldest !== undefined) {
    cache.get(oldest)?.free();
    cache.delete(oldest);
  }
}

function loadTrajectory(
  content: string,
  filename: string,
  context: RuntimeLoadContext,
  resources: RuntimeResources,
): void {
  freeRuntimeResources(resources);

  const format = inferFormatFromFilename(filename);
  resources.trajectoryReader = new TrajectoryReader(content, format);
  const frameCount = resources.trajectoryReader.getFrameCount();
  const reader = resources.trajectoryReader;
  const cache = resources.frameCache;

  const provider: FrameProvider = {
    length: frameCount,
    get(index: number): Frame {
      const cached = cache.get(index);
      if (cached) return cached;

      const frame = reader.readFrame(index);
      if (cache.size >= FRAME_CACHE_SIZE) {
        evictOldest(cache);
      }
      cache.set(index, frame);
      return frame;
    },
  };

  context.setTrajectory(Trajectory.fromProvider(provider));
  context.setViewMode();
  context.resetCamera();
}

function loadZarr(
  files: Record<string, string>,
  context: RuntimeLoadContext,
  resources: RuntimeResources,
): void {
  freeRuntimeResources(resources);

  const fileMap = new Map<string, Uint8Array>();
  for (const [filePath, contentB64] of Object.entries(files)) {
    fileMap.set(filePath, decodeBase64ToBytes(contentB64));
  }

  const reader = new MolRecReader(fileMap);
  resources.zarrReader = reader;
  const frameCount = reader.countFrames();
  const cache = resources.frameCache;

  const provider: FrameProvider = {
    length: frameCount,
    get(index: number): Frame {
      const cached = cache.get(index);
      if (cached) {
        return cached;
      }

      const raw = reader.readFrame(index);
      if (!raw) {
        throw new Error(`Zarr frame ${index} out of range`);
      }
      const frame = processZarrFrame(raw);

      if (cache.size >= FRAME_CACHE_SIZE) {
        evictOldest(cache);
      }
      cache.set(index, frame);
      return frame;
    },
  };

  context.setTrajectory(Trajectory.fromProvider(provider));
  context.setViewMode();
  context.resetCamera();
}

export function loadMolecularPayload(
  payload: MolecularFilePayload,
  filename: string,
  context: RuntimeLoadContext,
  resources: RuntimeResources,
): void {
  if (typeof payload !== "string") {
    loadZarr(payload, context, resources);
    return;
  }

  if (isTrajectoryFile(filename)) {
    loadTrajectory(payload, filename, context, resources);
    return;
  }

  // PDB files: use loadPdb() to build ribbon geometry from HELIX/SHEET records
  if (isPDBFile(filename) && context.loadPdb) {
    freeRuntimeResources(resources);
    context.loadPdb(payload);
    context.setViewMode();
    context.resetCamera();
    return;
  }

  freeRuntimeResources(resources);
  const frame = readFrame(payload, filename);
  const box = frame.simbox;
  resources.ownedFrames.push(frame);
  resources.boxes = box ? [box] : [];
  context.setTrajectory(new Trajectory([frame], [box]));
  context.setViewMode();
  context.resetCamera();
}
