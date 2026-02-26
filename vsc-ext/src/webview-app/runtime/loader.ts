import {
  type Box,
  type Frame,
  type FrameProvider,
  Trajectory,
  TrajectoryReader,
  ZarrReader,
  processZarrFrame,
  readFrame,
} from "@molvis/core";
import type { MolecularFilePayload } from "../../extension/types/messages";

export interface RuntimeLoadContext {
  setTrajectory: (trajectory: Trajectory) => void;
  setViewMode: () => void;
  resetCamera: () => void;
}

export interface RuntimeResources {
  trajectoryReader: TrajectoryReader | null;
  zarrReader: ZarrReader | null;
  boxes: Array<Box | undefined>;
}

export function createRuntimeResources(): RuntimeResources {
  return {
    trajectoryReader: null,
    zarrReader: null,
    boxes: [],
  };
}

function isXYZFile(filename: string): boolean {
  return filename.toLowerCase().endsWith(".xyz");
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

function loadTrajectory(
  content: string,
  context: RuntimeLoadContext,
  resources: RuntimeResources,
): void {
  freeRuntimeResources(resources);

  resources.trajectoryReader = new TrajectoryReader(content);
  const frameCount = resources.trajectoryReader.getFrameCount();
  const frames: Frame[] = [];
  const boxes: Array<Box | undefined> = [];

  for (let i = 0; i < frameCount; i++) {
    const frame = resources.trajectoryReader.readFrame(i);
    frames.push(frame);
    boxes.push(frame.simbox || undefined);
  }

  context.setTrajectory(new Trajectory(frames, boxes));
  resources.boxes = boxes;
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

  resources.zarrReader = new ZarrReader(fileMap);
  const frameCount = resources.zarrReader.len();
  const cache = new Map<number, Frame>();
  const reader = resources.zarrReader;

  const provider: FrameProvider = {
    length: frameCount,
    get(index: number): Frame {
      const cached = cache.get(index);
      if (cached) {
        return cached;
      }

      const raw = reader.read(index);
      if (!raw) {
        throw new Error(`Zarr frame ${index} out of range`);
      }
      const frame = processZarrFrame(raw);

      if (cache.size >= 8) {
        const oldest = cache.keys().next().value as number | undefined;
        if (oldest !== undefined) {
          cache.delete(oldest);
        }
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

  if (isXYZFile(filename)) {
    loadTrajectory(payload, context, resources);
    return;
  }

  freeRuntimeResources(resources);
  const frame = readFrame(payload, filename);
  const box = frame.simbox;
  context.setTrajectory(new Trajectory([frame], [box]));
  resources.boxes = box ? [box] : [];
  context.setViewMode();
  context.resetCamera();
}
