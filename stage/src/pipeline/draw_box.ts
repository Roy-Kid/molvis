import { Box, Frame } from "@molcrafts/molvis-core/molrs";
import { hasPresentBox, shouldDrawBox } from "../io/box_presence";
import { BaseModifier, ModifierCapability } from "./modifier";
import type { PipelineContext } from "./types";

/**
 * Whether a freshly auto-attached Simulation cell should start **enabled**
 * (checkbox on). Placeholder EM cells (`1×1×1`) still match / attach so the
 * step exists under the file loader, but default `enabled = false` — same
 * path as the user unchecking the row (no special "draw skip" branch).
 */
export function defaultSimulationCellEnabled(frame: {
  box?: import("@molcrafts/molvis-core/molrs").Box;
}): boolean {
  return shouldDrawBox(frame.box);
}

export interface DrawBoxSpec {
  lengths: [number, number, number];
  origin: [number, number, number];
  pbc: [boolean, boolean, boolean];
}

/**
 * Auto-attaches when the frame carries a simulation box, or when the user
 * adds a manual cell via the pipeline picker.
 *
 * **Two roles**
 * - **Visual** — draws the wireframe (`Draws` capability).
 * - **Data** — a *manual* box is a user-defined lattice: `apply` writes it
 *   onto the working frame as `frame.box` so every downstream consumer
 *   (Wrap PBC, bond MI, analysis, RDF, …) sees the same cell. Pipeline
 *   {@link executionOrder} promotes modifiers with
 *   {@link providesFrameBox} ahead of pure geometry transforms.
 *
 * `thicknessScale` rides on top of the camera-distance-aware edge
 * width — small/large values keep the wireframe legible at zoom
 * extremes that the auto-thickness alone can't cover.
 */
export class DrawBoxModifier extends BaseModifier {
  /** OVITO-style visual-element name (not "Draw …"). */
  static readonly NAME = "Simulation cell";
  private _thicknessScale = 1.0;
  private _manualBox: DrawBoxSpec | null = null;

  constructor(id = "draw-box", manualBox?: DrawBoxSpec | null) {
    super(id, DrawBoxModifier.NAME, new Set([ModifierCapability.Draws]));
    this.manualBox = manualBox ?? null;
  }

  matches(frame: Frame): boolean {
    // Attach whenever a cell exists (including EM 1×1×1 placeholders).
    // Auto-attach then sets `enabled` via {@link defaultSimulationCellEnabled}
    // so placeholder cells land with the checkbox **off** (same path as
    // the user disabling the modifier — not a separate draw skip).
    return this._manualBox !== null || hasPresentBox(frame.box);
  }

  /**
   * True when this modifier owns a user-defined cell that must be written
   * onto the working frame. Pipeline execution promotes these ahead of
   * pure geometry transforms so `frame.box` is populated first.
   */
  get providesFrameBox(): boolean {
    return this._manualBox !== null;
  }

  get thicknessScale(): number {
    return this._thicknessScale;
  }
  set thicknessScale(value: number) {
    if (this._thicknessScale === value) return;
    this._thicknessScale = value;
  }

  get manualBox(): DrawBoxSpec | null {
    return this._manualBox
      ? {
          lengths: [...this._manualBox.lengths],
          origin: [...this._manualBox.origin],
          pbc: [...this._manualBox.pbc],
        }
      : null;
  }

  set manualBox(value: DrawBoxSpec | null) {
    this._manualBox = value
      ? {
          lengths: [...value.lengths],
          origin: [...value.origin],
          pbc: [...value.pbc],
        }
      : null;
  }

  getCacheKey(): string {
    return `${super.getCacheKey()}:t=${this._thicknessScale}:box=${JSON.stringify(this._manualBox)}`;
  }

  apply(input: Frame, ctx: PipelineContext): Frame {
    // Manual box is frame data first, wireframe second. Always write
    // `frame.box` when the user defined a cell — even if the box mesh is
    // hidden — so Wrap PBC / analysis / bond MI keep working.
    //
    // Only free a Box we constructed ourselves. `input.box` is a
    // frame-owned getter handle — free() corrupts the frame's shared box
    // data for later reads (see memory: project_molrs_handle_ownership).
    const owned = this.createManualBox();
    const frame = owned ? frameWithBox(input, owned) : input;

    // Box geometry can change between frames (NPT trajectories), so
    // we redraw on every change kind including "position".
    // Visibility of this step is solely `this.enabled` + applyVisibility
    // (pipeline skips apply when disabled). No parallel "shouldDraw" gate.
    if (!ctx.app.styleManager.getShowBox()) {
      ctx.app.artist.drawBox(undefined);
      return frame;
    }
    ctx.app.artist.drawBox(frame.box, {
      thicknessScale: this._thicknessScale,
    });
    return frame;
  }

  applyVisibility(app: import("../app").MolvisApp, visible: boolean): void {
    if (!visible) {
      // Same clear path as apply() when the step is off / showBox false.
      app.artist.drawBox(undefined);
      return;
    }
    // Re-draw if the mesh was never built (e.g. started enabled=false for
    // an EM 1×1×1 cell, then the user checks the box).
    const frame = app.system.frame;
    if (frame?.box && app.styleManager.getShowBox()) {
      app.artist.drawBox(frame.box, {
        thicknessScale: this._thicknessScale,
      });
      return;
    }
    const boxMesh = app.world.scene.getMeshByName("sim_box");
    if (boxMesh) boxMesh.setEnabled(true);
  }

  private createManualBox(): Box | undefined {
    if (!this._manualBox) return undefined;
    const { lengths, origin, pbc } = this._manualBox;
    return Box.ortho(
      Float64Array.from(lengths),
      Float64Array.from(origin),
      pbc[0],
      pbc[1],
      pbc[2],
    );
  }
}

/**
 * Shallow re-pack of blocks onto a new Frame with `box` attached.
 * Blocks are shared (insertBlock takes a handle); only the frame shell
 * and box ownership are new. Caller transfers `box` ownership to the
 * returned frame — do not free it afterwards.
 */
function frameWithBox(input: Frame, box: Box): Frame {
  const result = new Frame();
  for (const name of input.blockNames()) {
    const block = input.getBlock(name);
    if (block) result.insertBlock(name, block);
  }
  result.box = box;
  return result;
}
