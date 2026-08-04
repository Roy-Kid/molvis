import type { Frame } from "@molcrafts/molvis-core/molrs";
import type { Artist } from "./artist";
import type { CommandManager } from "./commands/manager";
import type { ModifierPipeline } from "./pipeline";
import { applyAutoAttach } from "./pipeline/auto_attach";
import {
  DataSourceModifier,
  type DataSourceOptions,
  FileDataSource,
} from "./pipeline/data_source_modifier";
import {
  ensurePrimaryDataSource,
  installEmptyPrimaryScene,
} from "./pipeline/empty_scene";
import type { System } from "./system";
import type { Trajectory } from "./system/trajectory";

/**
 * Host surface needed by {@link SceneSession} to orchestrate scene loads
 * without owning the full {@link MolvisApp} façade.
 */
export interface SceneSessionHost {
  readonly artist: Artist;
  readonly commandManager: CommandManager;
  readonly pipeline: ModifierPipeline;
  readonly system: System;
  isRunning(): boolean;
  setFrameIndex(index: number): void;
  clearLastRenderedFrame(): void;
  renderActiveTrajectoryFrame(forceFull: boolean): Promise<void>;
  applyPipeline(opts: { fullRebuild: boolean }): Promise<Frame | null>;
}

/**
 * Scene / data-source orchestration extracted from {@link MolvisApp}.
 * Public app methods remain thin delegates for API stability.
 */
export class SceneSession {
  constructor(private readonly host: SceneSessionHost) {}

  /**
   * Boot / hard-reset path: Empty Scene as the sole primary data source.
   * See {@link installEmptyPrimaryScene} for the single-path invariant.
   */
  bootstrapEmptyPrimary(): void {
    installEmptyPrimaryScene(this.host.system, this.host.pipeline);
    this.host.setFrameIndex(this.host.system.trajectory.currentIndex);
    this.host.clearLastRenderedFrame();
  }

  /**
   * Replace the whole scene with a single source trajectory.
   *
   * Keeps the **single primary path**: pipeline never sits at zero data
   * sources. Clears prior sources/modifiers, installs one primary DS that
   * owns `trajectory`, and binds System to the same trajectory.
   *
   * Auto-attaches default Draw modifiers (Particles / Bonds / Box / …)
   * from frame 0 so file load / set_trajectory actually paint meshes.
   * RPC progressive draws (`scene.draw_atom` / `draw_frame`) go through
   * Edit commands (working tree) and only hit HEAD on `scene.commit`.
   *
   * Emits 'trajectory-change' through System.
   */
  async replaceScene(
    trajectory: Trajectory,
    meta?: DataSourceOptions,
  ): Promise<void> {
    this.host.artist.clear();
    this.host.commandManager.clearHistory();

    // Point System at the incoming trajectory *before* disposing pipeline
    // sources. After sketch/edit save, System may share a MemoryDataSource
    // trajectory; clearing first would free system.frame under active UI
    // listeners (null pointer passed to rust).
    await this.host.system.setTrajectory(trajectory);
    this.host.setFrameIndex(this.host.system.trajectory.currentIndex);
    this.host.clearLastRenderedFrame();

    this.host.pipeline.clear();
    // File load and memory/RPC replace both use FileDataSource as the
    // primary slot when the payload is an owned Trajectory. Empty-scene
    // boot uses MemoryDataSource via bootstrapEmptyPrimary instead.
    const newDS = new FileDataSource(trajectory, meta);
    this.host.pipeline.addModifier(newDS);
    // Invariant: ≥1 DS after replace.
    ensurePrimaryDataSource(this.host.system, this.host.pipeline);

    // Nest Draws under the primary DS (same as addDataSource / file load).
    const frame0 = this.host.system.frame;
    if (frame0) {
      applyAutoAttach(this.host.pipeline, frame0, undefined, newDS);
    }

    if (this.host.isRunning()) {
      await this.host.renderActiveTrajectoryFrame(true);
    }
  }

  /**
   * Append an *additional* {@link DataSourceModifier} to the pipeline (vs.
   * replaceScene, which replaces the primary source). The composition head
   * merges every enabled source at compute time.
   *
   * - Frame-count compatibility is NOT hard-checked: the composition head
   *   reconciles per-source counts at compute time (length-1 broadcast /
   *   equal-length zip / unequal>1 error with a concrete message).
   * - Auto-attach runs against this DS's frame 0 so default Draw modifiers
   *   (DrawAtom / DrawBond / DrawBox) get installed for the block kinds the
   *   source contributes.
   * - If this is the *first* FileDataSource in the pipeline, System adopts
   *   its trajectory so navigation, frame-change events, and the seek state
   *   machine keep working.
   */
  async addDataSource(ds: DataSourceModifier): Promise<void> {
    this.host.pipeline.addModifier(ds);

    // If this is the first FileDataSource, promote System to follow it.
    // Earlier MemoryDataSources stay in place and broadcast across the
    // newly grown timeline (their `getFrame(_)` ignores the index).
    if (ds instanceof FileDataSource) {
      const trajDSs = this.host.pipeline
        .getModifiers()
        .filter((m): m is FileDataSource => m instanceof FileDataSource);
      const isFirstTraj = trajDSs.length === 1;
      if (isFirstTraj) {
        await this.host.system.setTrajectory(ds.trajectory);
        this.host.setFrameIndex(this.host.system.trajectory.currentIndex);
        this.host.clearLastRenderedFrame();
      }
    }

    // Auto-attach Draw modifiers based on what this DS contributes.
    // Pre-load frame 0 so matches() can introspect the source frame.
    // Pass the DS as source owner so the new Draws nest under it in the UI.
    // tree (purely organizational nesting — no
    // selection semantics).
    await ds.preload(0);
    applyAutoAttach(this.host.pipeline, ds.cachedFrame, undefined, ds);

    if (this.host.isRunning()) {
      await this.host.applyPipeline({ fullRebuild: true });
    }
  }

  /**
   * Remove a {@link DataSourceModifier} from the pipeline. Cascades through
   * children (Draw modifiers nested under this DS) via the existing
   * {@link ModifierPipeline.removeModifier} semantics. Disposes the DS's WASM
   * resources. Removing a FileDataSource:
   * - If another FileDataSource remains, System adopts its
   *   trajectory; the system's frame count tracks that new primary.
   * - If none remain, System collapses to a single empty frame so
   *   navigation state stays well-defined (the composition head still
   *   produces an empty Frame from the remaining sources).
   *
   * Throws if `id` does not refer to a DataSourceModifier in the
   * pipeline. Use {@link ModifierPipeline.removeModifier} directly for
   * non-DS modifiers (Select / Hide / Color / Draws / etc.).
   */
  async removeDataSource(id: string): Promise<void> {
    const target = this.host.pipeline
      .getModifiers()
      .find(
        (m): m is DataSourceModifier =>
          m.id === id && m instanceof DataSourceModifier,
      );
    if (!target) {
      throw new Error(`No DataSourceModifier with id '${id}' in pipeline`);
    }

    // Re-derive system trajectory *before* dispose when System currently
    // shares this DS's trajectory (sketch/edit Empty Scene MemoryDataSource,
    // or the primary FileDataSource). Disposing first frees system.frame and
    // UI listeners that re-read it throw "null pointer passed to rust".
    const remainingSources = this.host.pipeline
      .getModifiers()
      .filter(
        (m): m is DataSourceModifier =>
          m instanceof DataSourceModifier && m.id !== id,
      );
    const systemSharedTrajectory =
      this.host.system.trajectory === target.trajectory;
    const needsSystemReassign =
      systemSharedTrajectory || target instanceof FileDataSource;

    if (remainingSources.length === 0) {
      // Single-path invariant: never leave zero data sources. Bootstrap
      // rebinds System, clears the pipeline (disposing this DS), and
      // installs Empty Scene as the new primary.
      this.host.artist.clear();
      this.host.commandManager.clearHistory();
      this.bootstrapEmptyPrimary();
      if (this.host.isRunning()) {
        await this.host.applyPipeline({ fullRebuild: true });
      }
      return;
    }

    if (needsSystemReassign) {
      const remainingFile = remainingSources.find(
        (m): m is FileDataSource => m instanceof FileDataSource,
      );
      const next = remainingFile ?? remainingSources[0];
      await this.host.system.setTrajectory(next.trajectory);
      this.host.setFrameIndex(this.host.system.trajectory.currentIndex);
      this.host.clearLastRenderedFrame();
    }

    const removed = this.host.pipeline.removeModifier(id);
    for (const m of removed) {
      if (m instanceof DataSourceModifier) m.dispose();
    }

    // Wipe GPU state before re-running so buffers from the removed source
    // cannot survive when composition no longer contributes those atoms.
    this.host.artist.clear();

    if (this.host.isRunning()) {
      await this.host.applyPipeline({ fullRebuild: true });
    }
  }
}
