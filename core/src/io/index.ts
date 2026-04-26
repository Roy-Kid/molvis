import type { MolvisApp as Molvis } from "../app";
import type { Trajectory } from "../system/trajectory";
import { ensureDataSource } from "../transport/rpc/router";
import { type FileFormat, loadTextTrajectory, readFrames } from "./reader";
import { loadZarrFiles } from "./zarr";

export {
  describeFormat,
  type FileFormat,
  type FileFormatDescriptor,
  FILE_FORMAT_REGISTRY,
  getAllAcceptExtensions,
  inferFormatFromFilename,
  loadTextTrajectory,
  readFrames,
} from "./reader";
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

// Tracks per-app cleanup for the active lazy trajectory reader so that
// swapping in a new trajectory frees the previous
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
  format?: FileFormat,
): Promise<void> {
  appCleanups.get(app)?.();
  appCleanups.delete(app);

  ensureDataSource(app, { sourceType: "file", filename });

  let trajectory: Trajectory;

  if (typeof content === "string") {
    const bundle = loadTextTrajectory(content, filename, format);
    trajectory = bundle.trajectory;
    appCleanups.set(app, bundle.dispose);
  } else {
    const bundle = loadZarrFiles(content);
    trajectory = bundle.trajectory;
    appCleanups.set(app, bundle.dispose);
  }

  await app.setTrajectory(trajectory);
  await app.applyPipeline({ fullRebuild: true });
  app.world.resetCamera();

  app.setMode("view");
}
