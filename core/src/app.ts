import { Engine, Tools } from "@babylonjs/core";
import { Artist } from "./artist";
import { findRepresentation } from "./artist/representation";
import { StyleManager } from "./artist/style_manager";
import type { Theme } from "./artist/theme";
import { type CommandRegistry, commands } from "./commands";
import { DrawFrameCommand, type DrawFrameOption } from "./commands/draw";
import { UpdateFrameCommand } from "./commands/frame";
import { CommandManager } from "./commands/manager";
import { SetRepresentationCommand } from "./commands/representation";
import { ArrayFrameSource } from "./commands/sources";
import { type MolvisConfig, defaultMolvisConfig } from "./config";
import { EventEmitter, type MolvisEventMap } from "./events";
import { ModeManager, ModeType } from "./mode";
import { SelectMode } from "./mode/select";
import type { HitResult } from "./mode/types";
import { ModifierPipeline, PipelineEvents } from "./pipeline";
import type { FrameSource } from "./pipeline/pipeline";
import { readPDBFrame } from "./reader";
import { syncSceneToFrame } from "./scene_sync";
import { type MolvisSetting, Settings } from "./settings";
import { System } from "./system";
import {
  type FrameTransitionDecision,
  type FrameUpdateKind,
  classifyFrameTransition,
} from "./system/frame_diff";
import type { Trajectory } from "./system/trajectory";
import { GUIManager } from "./ui/manager";
import { logger } from "./utils/logger";
import { MOLVIS_VERSION } from "./version";
import { World } from "./world";

import type { Box, Frame } from "molrs-wasm";
import {
  MolvisButton,
  MolvisFolder,
  MolvisSeparator,
  MolvisSlider,
} from "./ui/components";
import { MolvisContextMenu } from "./ui/menus/context_menu";

interface StructuralSelectionSnapshot {
  atomIds: number[];
  hasExpressionSelection: boolean;
}

export class MolvisApp {
  // DOM elements
  private _container: HTMLElement;
  private _root: HTMLElement;
  private _canvas: HTMLCanvasElement;
  private _uiOverlay: HTMLElement;

  // Core components
  private _config: MolvisConfig;
  private _engine: Engine;
  private _world: World;
  private _system: System;
  private _modeManager!: ModeManager;
  private _guiManager!: GUIManager;
  private _isRunning = false;
  private _rendererReady = true;

  // Pipelines
  private _modifierPipeline: ModifierPipeline;
  private _currentFrame = 0;
  private _lastRenderedFrame: Frame | null = null;
  private _frameRenderQueue: Promise<void> = Promise.resolve();
  private _pendingFrameRender: { forceFull: boolean } | null = null;

  // Style System
  private _styleManager: StyleManager;

  // Command registry (Registry/RPC)
  readonly commands: CommandRegistry;

  // Command Manager (History/Undo/Redo)
  public readonly commandManager: CommandManager;

  // Artist (high-level drawing API)
  public readonly artist: Artist;

  // Events
  public readonly events = new EventEmitter<MolvisEventMap>();

  // User settings (public API)
  public readonly settings: Settings;

  /**
   * Pluggable file-save handler. Override to integrate with host environment
   * (e.g. VSCode webview → postMessage → extension host → showSaveDialog).
   * Default: uses the File System Access API (showSaveFilePicker).
   */
  public saveFile: (blob: Blob, suggestedName: string) => Promise<void> =
    defaultSaveFile;

  constructor(
    container: HTMLElement,
    config: MolvisConfig = {},
    setting?: Partial<MolvisSetting>,
  ) {
    this._config = defaultMolvisConfig(config);
    this._container = container;
    logger.info(`Molvis initializing (v${MOLVIS_VERSION})`);

    // Register Web Components
    this.registerWebComponents();

    // Create DOM structure
    this._root = this._createRoot();
    this._canvas = this._createCanvas();
    this._uiOverlay = this._createUIOverlay();

    // Assemble DOM (order is critical!)
    this._root.appendChild(this._canvas);
    this._root.appendChild(this._uiOverlay);
    this._container.appendChild(this._root);

    // Initialize Babylon engine
    this._engine = new Engine(
      this._canvas,
      this._config.canvas?.antialias ?? true,
      {
        preserveDrawingBuffer:
          this._config.canvas?.preserveDrawingBuffer ?? true,
        stencil: this._config.canvas?.stencil ?? true,
        alpha: this._config.canvas?.alpha ?? false,
      },
      true,
    );

    // Initialize World
    this._world = new World(this._canvas, this._engine, this);

    // Initialize Style Manager (before ModeManager)
    this._styleManager = new StyleManager(this._world.scene);

    // Initialize settings
    this.settings = new Settings(this, setting);

    // Initialize System
    this._system = new System(this.events);

    // Initialize GUI
    this._guiManager = new GUIManager(this._container, this, this._config);
    this._guiManager.mount();

    // Initialize default mode (View mode)
    this._modeManager = new ModeManager(this);
    this._modeManager.switch_mode(ModeType.View);
    this._world.setMode(this._modeManager);

    // Initialize modifier pipeline
    this._modifierPipeline = new ModifierPipeline();

    // Initialize Artist (Drawing Logic)
    this.artist = new Artist({ app: this });

    // Initialize command registry (use shared singleton)
    this.commands = commands;

    // Initialize Command Manager
    this.commandManager = new CommandManager(this);

    // Wire scene-level dirty tracking to event bus
    this._world.sceneIndex.onDirtyChange = (isDirty: boolean) => {
      this.events.emit("dirty-change", isDirty);
    };

    // Sync pipeline selection output to SelectionManager
    this._modifierPipeline.on(PipelineEvents.COMPUTED, ({ context }) => {
      const mask = context.currentSelection;
      if (!mask) return;

      const atomKeys: string[] = [];
      for (const idx of mask.getIndices()) {
        const key = this._world.sceneIndex.getSelectionKeyForAtom(idx);
        if (key) atomKeys.push(key);
      }

      const bondKeys: string[] = [];
      for (const bondId of context.selectedBondIds) {
        const key = this._world.sceneIndex.getSelectionKeyForBond(bondId);
        if (key) bondKeys.push(key);
      }

      this._world.selectionManager.apply({
        type: "replace",
        atoms: atomKeys,
        bonds: bondKeys,
      });
    });
  }

  /**
   * Register all web components for context menus
   */
  private registerWebComponents(): void {
    // Register custom elements
    if (!customElements.get("molvis-context-menu")) {
      customElements.define("molvis-context-menu", MolvisContextMenu);
    }
    if (!customElements.get("molvis-button")) {
      customElements.define("molvis-button", MolvisButton);
    }
    if (!customElements.get("molvis-separator")) {
      customElements.define("molvis-separator", MolvisSeparator);
    }
    if (!customElements.get("molvis-folder")) {
      customElements.define("molvis-folder", MolvisFolder);
    }
    if (!customElements.get("molvis-slider")) {
      customElements.define("molvis-slider", MolvisSlider);
    }
  }

  private _createRoot(): HTMLElement {
    const root = document.createElement("div");
    root.className = "molvis-root";

    // Fill parent container completely (no scrollbars, no white edges)
    root.style.position = "relative";
    root.style.width = "100%";
    root.style.height = "100%";
    root.style.overflow = "hidden";
    root.style.margin = "0";
    root.style.padding = "0";

    return root;
  }

  private _createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.className = "molvis-canvas";

    // Canvas fills the root container
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.outline = "none";
    canvas.style.touchAction = "none";

    // Prevent default scrolling when zooming
    canvas.addEventListener(
      "wheel",
      (evt) => {
        evt.preventDefault();
      },
      { passive: false },
    );

    // Set initial canvas resolution based on container size.
    // Babylon will manage the backing-store scale via engine.resize().
    const width = this._container.clientWidth || 800;
    const height = this._container.clientHeight || 600;

    canvas.width = Math.floor(width);
    canvas.height = Math.floor(height);

    return canvas;
  }

  private _createUIOverlay(): HTMLElement {
    const overlay = document.createElement("div");
    overlay.className = "molvis-ui-overlay";

    // Absolute positioned to cover canvas
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.pointerEvents = "none";

    if (this._config.showUI === false) {
      overlay.style.display = "none";
    }

    return overlay;
  }

  // Getters
  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  get world(): World {
    return this._world;
  }

  get scene() {
    return this._world.scene;
  }

  get mode() {
    return this._world.mode;
  }

  get modifierPipeline(): ModifierPipeline {
    return this._modifierPipeline;
  }

  get styleManager(): StyleManager {
    return this._styleManager;
  }

  get gui(): GUIManager {
    return this._guiManager;
  }

  get rootContainer(): HTMLElement {
    return this._root;
  }

  get uiContainer(): HTMLElement {
    return this._uiOverlay;
  }

  get mountPoint(): HTMLElement {
    return this._container;
  }

  get config(): MolvisConfig {
    return this._config;
  }

  get displaySize(): { width: number; height: number } {
    const rect = this._root.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  get renderResolution(): { width: number; height: number } {
    return { width: this._canvas.width, height: this._canvas.height };
  }

  get pixelRatio(): number {
    const size = this.displaySize;
    if (size.width === 0) return 1;
    return this._canvas.width / size.width;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get rendererReady(): boolean {
    return this._rendererReady;
  }

  get currentFrame(): number {
    return this._currentFrame;
  }

  set currentFrame(value: number) {
    this._currentFrame = value;
  }

  get frame(): Frame | null {
    return this._system.frame;
  }

  set frame(value: Frame | null) {
    this._system.frame = value;
  }

  get system(): System {
    return this._system;
  }

  // Public methods
  /**
   * Execute a command by name.
   * @param name Command name
   * @param args Command arguments
   * @returns Promise if command is async, void otherwise
   */
  public execute<A, R = unknown>(name: string, args: A): R | Promise<R> {
    return this.commands.execute(name, this, args);
  }

  public async pickAtPointer(
    pointerX: number,
    pointerY: number,
  ): Promise<HitResult> {
    return this._world.picker.pick(pointerX, pointerY);
  }

  public async start(): Promise<void> {
    if (this._isRunning) return;

    this._isRunning = true;
    this._world.start();

    // Render the initial frame so mesh layers are registered and
    // edit-mode can draw into an empty scene.
    await this.renderActiveTrajectoryFrame(true);

    logger.info("Molvis started successfully");
  }

  public stop(): void {
    if (!this._isRunning) return;
    this._isRunning = false;
    this._world.stop();
    logger.info("Molvis stopped successfully");
  }

  public resize = (): void => {
    // Let Babylon's engine.resize() read the canvas CSS size and update the
    // drawing-buffer dimensions internally.  Manually setting canvas.width /
    // canvas.height *before* the engine does it clears the bitmap and causes a
    // visible flash during continuous resize (e.g. dragging a splitter).
    this._world.resize();
  };

  public setSize(displayWidth: number, displayHeight: number): void {
    this._root.style.width = `${displayWidth}px`;
    this._root.style.height = `${displayHeight}px`;
    this.resize();
  }

  public setRenderResolution(renderWidth: number, renderHeight: number): void {
    this._canvas.width = renderWidth;
    this._canvas.height = renderHeight;
    this._world.resize();
  }

  public enableFitContainer(enabled: boolean): void {
    if (enabled) {
      this._root.style.width = "100%";
      this._root.style.height = "100%";
    }
    this.resize();
  }

  public save(): void {
    const frame = this._system.frame;
    if (frame) {
      syncSceneToFrame(this._world.sceneIndex, frame);
    }
  }

  /**
   * Capture the current viewport as a PNG data URL.
   * Uses BabylonJS render-target screenshot for consistent quality.
   */
  public async screenshot(options?: {
    width?: number;
    height?: number;
    transparentBackground?: boolean;
  }): Promise<string> {
    const width = options?.width ?? this._canvas.width;
    const height = options?.height ?? this._canvas.height;
    const savedAlpha = this._world.scene.clearColor.a;

    if (options?.transparentBackground) {
      this._world.scene.clearColor.a = 0;
    }

    try {
      const data = await Tools.CreateScreenshotUsingRenderTargetAsync(
        this._engine,
        this._world.scene.activeCamera!,
        { width, height },
      );
      return data;
    } finally {
      if (options?.transparentBackground) {
        this._world.scene.clearColor.a = savedAlpha;
      }
    }
  }

  public destroy(): void {
    this.stop();
    this._guiManager.unmount();
    this._lastRenderedFrame = null;
    this._pendingFrameRender = null;
    this._engine.dispose();

    if (this._root.parentElement) {
      this._root.parentElement.removeChild(this._root);
    }

    logger.info("Molvis destroyed and cleaned up");
  }

  public setMode(mode: string): void {
    switch (mode) {
      case "view":
        this._modeManager.switch_mode(ModeType.View);
        break;
      case "select":
        this._modeManager.switch_mode(ModeType.Select);
        break;
      case "edit":
        this._modeManager.switch_mode(ModeType.Edit);
        break;
      case "measure":
        this._modeManager.switch_mode(ModeType.Measure);
        break;
      case "manipulate":
        this._modeManager.switch_mode(ModeType.Manipulate);
        break;
      default:
        logger.warn(`Unknown mode: ${mode}`);
        break;
    }
  }

  /**
   * Enter fence (lasso) selection mode. Disables camera, enables drawing.
   * Only works when in Select mode.
   */
  public enterFenceSelect(): void {
    const mode = this._world.mode;
    if (mode instanceof SelectMode) {
      mode.enterFenceMode();
    }
  }

  /**
   * Exit fence selection mode. Re-enables camera.
   */
  public exitFenceSelect(): void {
    const mode = this._world.mode;
    if (mode instanceof SelectMode) {
      mode.exitFenceMode();
    }
  }

  /**
   * Confirm the pending manual selection by committing it as a SelectModifier.
   * Only works when in Select mode.
   */
  public confirmPendingSelection(): void {
    const mode = this._world.mode;
    if (mode instanceof SelectMode) {
      mode.confirmPendingSelection();
    }
  }

  /**
   * Clear the pending selection without committing.
   * Only works when in Select mode.
   */
  public clearPendingSelection(): void {
    const mode = this._world.mode;
    if (mode instanceof SelectMode) {
      mode.clearPending();
    }
  }

  public setTheme(theme: Theme): void {
    this._styleManager.setTheme(theme);
    if (this._system.frame) {
      this.renderFrame(this._system.frame);
    }
  }

  public setRepresentation(name: string): void {
    const repr = findRepresentation(name);
    if (repr) {
      void this.commandManager.execute(
        new SetRepresentationCommand(this, { style: repr }),
      );
    }
  }

  /**
   * Update configuration at runtime.
   * Merges with existing config and propagates changes.
   */
  public setConfig(newConfig: Partial<MolvisConfig>): void {
    this._config = defaultMolvisConfig({ ...this._config, ...newConfig });

    if (newConfig.showUI !== undefined) {
      this._uiOverlay.style.display = this._config.showUI ? "block" : "none";
    }
  }

  /**
   * Compute a frame using the modifier pipeline.
   * @param frameIndex Index of frame to compute
   * @param source Frame source
   * @returns Promise resolving to the computed frame
   */
  public async computeFrame(
    frameIndex: number,
    source?: FrameSource,
  ): Promise<Frame> {
    if (!source) {
      throw new Error("computeFrame requires a source");
    }
    logger.info(
      `App: computeFrame called with source ${source} index ${frameIndex}`,
    );
    const frame = await this._modifierPipeline.compute(
      source,
      frameIndex,
      this,
    );
    this._currentFrame = frameIndex;
    return frame;
  }

  /**
   * Queue a trajectory frame render using a "latest-wins" pattern.
   * Rapid calls (e.g. timeline scrubbing) coalesce: only the most recent
   * request executes after the current render finishes, skipping intermediates.
   */
  private queueTrajectoryFrameRender(forceFull = false): void {
    if (!this._isRunning) return;

    // If a render is already queued, upgrade to forceFull if requested.
    if (this._pendingFrameRender) {
      if (forceFull) this._pendingFrameRender.forceFull = true;
      return;
    }

    this._pendingFrameRender = { forceFull };
    this._frameRenderQueue = this._frameRenderQueue
      .catch(() => {
        // Previous render failure is already logged; keep queue alive.
      })
      .then(async () => {
        // Drain the pending request (latest wins).
        const pending = this._pendingFrameRender;
        this._pendingFrameRender = null;
        if (pending) {
          await this.renderActiveTrajectoryFrame(pending.forceFull);
        }
      })
      .catch((error) => {
        logger.error("Failed to render trajectory frame", error);
      });
  }

  private captureStructuralSelectionSnapshot(): StructuralSelectionSnapshot {
    const selection = this._world.selectionManager;
    return {
      atomIds: [...selection.getSelectedAtomIds()],
      hasExpressionSelection: selection.hasExpressionSelectionContext(),
    };
  }

  private reconcileSelectionAfterStructuralUpdate(
    updateKind: Exclude<FrameUpdateKind, "position">,
    snapshot: StructuralSelectionSnapshot,
  ): void {
    const selection = this._world.selectionManager;

    if (snapshot.hasExpressionSelection) {
      const rehydrated = selection.reapplyLastExpression();
      if (!rehydrated) {
        selection.clearSelection();
      }
      return;
    }

    if (updateKind === "bond" && snapshot.atomIds.length > 0) {
      selection.replaceAtomsByIds(snapshot.atomIds);
      return;
    }

    selection.clearSelection();
  }

  /**
   * Render the currently active trajectory frame.
   *
   * NOTE: This method deliberately bypasses the CommandManager and constructs
   * UpdateFrameCommand / DrawFrameCommand directly. Trajectory playback renders
   * are transient (not user-reversible) and must not pollute the undo history.
   */
  private async renderActiveTrajectoryFrame(forceFull = false): Promise<void> {
    const frame = this._system.frame;
    const box = this._system.box;
    this._currentFrame = this._system.trajectory.currentIndex;

    const atomCount = frame.getBlock("atoms")?.nrows() ?? 0;
    const bondCount = frame.getBlock("bonds")?.nrows() ?? 0;
    let decision: FrameTransitionDecision = forceFull
      ? {
          kind: "full",
          reasons: ["Forced full rebuild"],
          stats: { atomCount, bondCount },
        }
      : classifyFrameTransition(this._lastRenderedFrame, frame);

    if (decision.kind === "position") {
      const updateCmd = new UpdateFrameCommand(this, { frame });
      const result = await updateCmd.do();
      if (result.success) {
        if (box) {
          this.execute("draw_box", { box });
        }
        this._lastRenderedFrame = frame;
        return;
      }
      logger.warn(
        `Position update failed (${result.reason ?? "unknown reason"}), falling back to full rebuild`,
      );
      decision = {
        kind: "full",
        reasons: [
          ...decision.reasons,
          `Fast update failed: ${result.reason ?? "unknown reason"}`,
        ],
        stats: decision.stats,
      };
    }

    const selectionSnapshot = this.captureStructuralSelectionSnapshot();
    const drawCmd = new DrawFrameCommand(this, { frame, box });
    await drawCmd.do();
    this.reconcileSelectionAfterStructuralUpdate(
      decision.kind as Exclude<FrameUpdateKind, "position">,
      selectionSnapshot,
    );
    this._lastRenderedFrame = frame;
  }

  /**
   * Render a frame using the draw_frame command.
   * @param frame Frame to render
   * @param options Drawing options
   */
  private renderFrameInternal(
    frame: Frame,
    box?: Box,
    options?: DrawFrameOption,
  ): Promise<void> {
    this._system.updateCurrentFrame(frame, box);

    const drawResult = this.execute("draw_frame", { frame, box, options });
    const done = drawResult instanceof Promise ? drawResult : Promise.resolve();
    return done.then(() => {
      this._lastRenderedFrame = frame;
    });
  }

  public renderFrame(frame: Frame, box?: Box, options?: DrawFrameOption): void {
    void this.renderFrameInternal(frame, box, options).catch((error) => {
      logger.error("draw_frame failed", error);
    });
  }

  /**
   * Load a new frame into the system, clearing the existing scene.
   * Consolidates scene clearing, history reset, and initial rendering.
   */
  public loadFrame(frame: Frame, box?: Box): void {
    this.artist.clear();
    this.artist.ribbonRenderer.dispose();
    this.commandManager.clearHistory();
    this._lastRenderedFrame = null;
    this._system.setFrame(frame, box);
    this.renderFrame(frame, box);
  }

  /**
   * Load a PDB file. Reads the frame AND builds ribbon geometry from
   * backbone/secondary structure data (HELIX/SHEET records) if present.
   */
  public loadPdb(pdbText: string): void {
    const frame = readPDBFrame(pdbText);
    const box = frame.simbox;
    this.loadFrame(frame, box);
    // Build ribbon AFTER loadFrame (which clears old ribbon)
    this.artist.ribbonRenderer.buildFromPdb(pdbText);
    const repr = this._styleManager.getRepresentation();
    this.artist.ribbonRenderer.setVisible(repr.showRibbon);
  }

  /**
   * Run the modifier pipeline on the current system frame and apply the result.
   * Use fullRebuild when the atom count or topology changes (e.g. file load).
   * Default is fast-path (visibility-only update, no flicker).
   */
  public async applyPipeline(options?: {
    fullRebuild?: boolean;
  }): Promise<void> {
    const sourceFrame = this._system.frame;
    if (!sourceFrame) return;

    const source = new ArrayFrameSource([sourceFrame]);
    const computed = await this._modifierPipeline.compute(
      source,
      this._currentFrame,
      this,
    );

    if (options?.fullRebuild) {
      await this.renderFrameInternal(computed);
    } else {
      this.artist.redrawFrame(computed);
    }
  }

  /**
   * Set the current trajectory and update the system.
   * Emits 'trajectory-change' event.
   */
  public setTrajectory(trajectory: Trajectory): void {
    this.artist.clear();
    this.artist.ribbonRenderer.dispose();
    this.commandManager.clearHistory();
    this._system.trajectory = trajectory;
    this._currentFrame = this._system.trajectory.currentIndex;
    this._lastRenderedFrame = null;
    this.queueTrajectoryFrameRender(true);
  }

  /**
   * Navigate to the next frame.
   */
  public nextFrame(): void {
    if (this._system.nextFrame()) {
      this._currentFrame = this._system.trajectory.currentIndex;
      this.queueTrajectoryFrameRender();
    }
  }

  /**
   * Navigate to the previous frame.
   */
  public prevFrame(): void {
    if (this._system.prevFrame()) {
      this._currentFrame = this._system.trajectory.currentIndex;
      this.queueTrajectoryFrameRender();
    }
  }

  /**
   * Seek to a specific frame index.
   */
  public seekFrame(index: number): void {
    if (this._system.seekFrame(index)) {
      this._currentFrame = this._system.trajectory.currentIndex;
      this.queueTrajectoryFrameRender();
    }
  }
}

// File System Access API — not yet in lib.dom.d.ts
declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<{
      createWritable(): Promise<{
        write(data: Blob): Promise<void>;
        close(): Promise<void>;
      }>;
    }>;
  }
}

async function defaultSaveFile(
  blob: Blob,
  suggestedName: string,
): Promise<void> {
  if (typeof window.showSaveFilePicker !== "function") {
    throw new Error(
      "Save dialog not available in this environment. Override app.saveFile to provide a custom implementation.",
    );
  }

  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [
      {
        description: "Molecular structure files",
        accept: {
          "chemical/x-pdb": [".pdb"],
          "chemical/x-xyz": [".xyz"],
          "text/plain": [".lammps"],
        },
      },
    ],
  });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}
