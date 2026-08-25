/**
 * Draw surface — the one step that paints computed surface geometry.
 *
 * Every surface algorithm ends in triangles, so every surface algorithm can
 * share this. A producer publishes {@link SurfacePart}s into
 * `context.surfaces` under its own id; this reads the ones belonging to its
 * producer and hands them to the surface renderer. Adding a seventh algorithm
 * touches no rendering code at all.
 *
 * The split also makes appearance cheap. Colour and opacity live here, not on
 * the algorithm, so changing them repaints without re-running marching cubes
 * — or, worse, a Delaunay tetrahedralisation.
 */

import type { Frame } from "@molcrafts/molvis-core/molrs";
import type { MolvisApp } from "../app";
import {
  DEFAULT_SURFACE_DRAW_STYLE,
  type SurfaceDrawStyle,
} from "../artist/surface/surface_mesh_renderer";
import { BaseModifier, ModifierCapability } from "./modifier";
import type { PipelineContext } from "./types";

export class DrawSurfaceModifier extends BaseModifier {
  static readonly NAME = "Draw surface";

  /** The `ProducesGeometry` modifier whose parts this paints. */
  producerId: string | null = null;
  private _style: SurfaceDrawStyle = { ...DEFAULT_SURFACE_DRAW_STYLE };
  private _app: MolvisApp | null = null;

  constructor(id = "draw-surface", producerId: string | null = null) {
    super(id, DrawSurfaceModifier.NAME, new Set([ModifierCapability.Draws]));
    this.producerId = producerId;
  }

  get style(): SurfaceDrawStyle {
    return this._style;
  }

  setStyle(patch: Partial<SurfaceDrawStyle>): void {
    this._style = { ...this._style, ...patch };
  }

  /** Never a default layer: it arrives with the producer that needs it. */
  matches(_frame: Frame): boolean {
    return false;
  }

  getCacheKey(): string {
    const s = this._style;
    return `${super.getCacheKey()}:p=${this.producerId ?? "-"}:rgb=${s.color.join(",")}:o=${s.opacity}:f=${s.finish}`;
  }

  apply(input: Frame, ctx: PipelineContext): Frame {
    this._app = ctx.app;
    const parts = this.producerId
      ? (ctx.surfaces.get(this.producerId) ?? [])
      : [];
    // A producer that is disabled, refused, or found nothing publishes
    // nothing — clearing here is what makes the surface disappear with it.
    if (parts.length === 0) {
      ctx.app.artist.surfaceLayer(this.id).dispose();
      return input;
    }
    ctx.app.artist.drawSurfaceParts(this.id, parts, this._style);
    return input;
  }

  applyVisibility(app: MolvisApp, visible: boolean): void {
    app.artist.surfaceLayer(this.id).setVisible(visible);
  }

  onRemoved(): void {
    this._app?.artist.releaseSurfaceLayer(this.id);
    this._app = null;
  }
}
