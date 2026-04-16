import type { Frame, Molvis } from "@molvis/core";
import { Trajectory } from "@molvis/core";
import {
  TrajectoryReader,
  inferFormatFromFilename,
  readFrame,
  readPDBFrame,
} from "@molvis/core/io";

/** Formats that may carry more than one frame. */
const TRAJECTORY_FORMATS = new Set(["xyz", "lammps-dump"]);

export interface LoadFileOptions {
  /** Optional callback fired with the first frame after a successful load. */
  onFirstFrame?: (frame: Frame, filename: string) => void;
}

/**
 * Single entry point for loading a molecular file into a MolvisApp from the
 * page UI. Used by the canvas drag-drop handler and the DataSource panel's
 * "Load File" button — both paths must converge here so trajectory state
 * (and the timeline indicator) stays consistent.
 *
 * Dispatch:
 * - PDB: readPDBFrame + loadFrame, then build ribbon from HELIX/SHEET records.
 * - XYZ multi-frame: streamed into a Trajectory via setTrajectory.
 * - XYZ single-frame / LAMMPS data / unknown: readFrame + loadFrame.
 * - LAMMPS dump trajectories: not yet supported by molrs — throws.
 */
export async function loadFileIntoApp(
  app: Molvis,
  file: File,
  options?: LoadFileOptions,
): Promise<void> {
  const text = await file.text();
  const format = inferFormatFromFilename(file.name);

  if (format === "pdb") {
    const frame = readPDBFrame(text);
    await app.loadFrame(frame, frame.simbox);
    app.artist.ribbonRenderer.buildFromPdb(text);
    const repr = app.styleManager.getRepresentation();
    app.artist.ribbonRenderer.setVisible(repr.showRibbon);
    options?.onFirstFrame?.(frame, file.name);
  } else if (TRAJECTORY_FORMATS.has(format)) {
    const reader = new TrajectoryReader(text, format);
    try {
      const count = reader.getFrameCount();
      if (count > 1) {
        const frames: Frame[] = [];
        for (let i = 0; i < count; i++) {
          frames.push(reader.readFrame(i));
        }
        app.setTrajectory(new Trajectory(frames));
        options?.onFirstFrame?.(frames[0], file.name);
      } else {
        const frame = reader.readFrame(0);
        await app.loadFrame(frame, frame.simbox);
        options?.onFirstFrame?.(frame, file.name);
      }
    } finally {
      reader.free();
    }
  } else {
    const frame = readFrame(text, file.name);
    await app.loadFrame(frame, frame.simbox);
    options?.onFirstFrame?.(frame, file.name);
  }

  app.setMode("view");
  app.world.resetCamera();
}
