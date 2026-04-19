import type { Frame } from "@molcrafts/molrs";
import type { MolvisApp as Molvis } from "../app";
import { Trajectory } from "../system/trajectory";
import { ensureDataSource } from "../transport/rpc/router";
import { readFrames } from "./reader";
import { loadZarrFiles } from "./zarr";

export { type FileFormat, inferFormatFromFilename, readFrames } from "./reader";
export { loadZarrFiles, type ZarrLoadResult } from "./zarr";
export {
  defaultExtensionForFormat,
  exportFrame,
  type ExportFormat,
  type ExportPayload,
  mimeForFormat,
  writeFrame,
  type WriteFrameOptions,
  writeLAMMPSData,
  writePDBFrame,
  writeXYZFrame,
} from "./writer";

/**
 * Payload shape accepted by {@link loadFileContent}. A string is a text
 * format (.pdb/.xyz/.lammps/.dump/etc.); an object is a zarr directory
 * serialized as `filePath → base64` pairs.
 */
export type FileContent = string | Record<string, string>;

// Tracks per-app cleanup for the active trajectory (e.g. a lazy zarr
// reader) so that swapping in a new trajectory frees the previous
// WASM-owned resources exactly once.
const appCleanups = new WeakMap<Molvis, () => void>();

/**
 * Canonical file ingress for `@molvis/core`. Dispatches to the right
 * reader based on payload shape (string → text format, object → zarr),
 * stamps the pipeline head with a `DataSourceModifier`, swaps in the
 * new trajectory, and replays user-added modifiers on it. All file
 * entry points — page drag-drop, DataSource panel "Load File", vsc-ext
 * "Open Editor" / "Quick View" — converge here.
 */
export async function loadFileContent(
  app: Molvis,
  content: FileContent,
  filename: string,
): Promise<void> {
  appCleanups.get(app)?.();
  appCleanups.delete(app);

  const dataSource = ensureDataSource(app, { sourceType: "file", filename });

  let trajectory: Trajectory;
  let firstFrame: Frame;

  if (typeof content === "string") {
    const frames = readFrames(content, filename);
    const boxes = frames.map((f) => f.simbox);
    trajectory = new Trajectory(frames, boxes);
    firstFrame = frames[0];
  } else {
    const bundle = loadZarrFiles(content);
    trajectory = bundle.trajectory;
    firstFrame = bundle.firstFrame;
    appCleanups.set(app, bundle.dispose);
  }

  dataSource.setFrame(firstFrame);
  await app.setTrajectory(trajectory);
  await app.applyPipeline({ fullRebuild: true });
  app.world.resetCamera();

  app.setMode("view");
}
