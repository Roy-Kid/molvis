/**
 * Isosurface — a level set of a volumetric grid, as surface geometry.
 *
 * Consumes the `grid` block that CUBE / CHGCAR / XSF readers put on the
 * frame, meshes it with marching cubes, and publishes the triangles for its
 * paired {@link ./draw_surface Draw surface} step. It computes; it does not
 * paint.
 *
 * Signed channels — molecular orbitals, spin differences — publish both
 * lobes, and the draw step colours the complement against the primary.
 *
 * Auto-attaches when a frame arrives carrying a grid, the same way Particles
 * and Bonds do for atoms: opening a CUBE file should show the density.
 */

import type { Frame } from "@molcrafts/molvis-core/molrs";
import { marchingCubes } from "../algo/marching_cubes";
import {
  channelIsSigned,
  defaultIsovalueFor,
  gridChannels,
  hasMeshableGrid,
  readGridField,
} from "../algo/surface/grid_field";
import type { SurfacePart } from "../algo/surface_mesh";
import { DrawSurfaceModifier } from "./draw_surface";
import {
  BaseModifier,
  type GeometryProducer,
  ModifierCapability,
} from "./modifier";
import type { PipelineContext } from "./types";

export class IsosurfaceModifier
  extends BaseModifier
  implements GeometryProducer
{
  static readonly NAME = "Isosurface";

  private _channel: string | null = null;
  private _isovalue: number | null = null;
  private _showNegative: boolean | null = null;

  constructor(id = "isosurface") {
    super(
      id,
      IsosurfaceModifier.NAME,
      new Set([ModifierCapability.ProducesGeometry]),
    );
  }

  createDraw(): DrawSurfaceModifier {
    return new DrawSurfaceModifier("draw-surface", this.id);
  }

  /** `null` until the first run picks one from the frame's channels. */
  get channel(): string | null {
    return this._channel;
  }
  get isovalue(): number | null {
    return this._isovalue;
  }
  get showNegative(): boolean {
    return this._showNegative ?? false;
  }

  setChannel(channel: string): void {
    if (channel === this._channel) return;
    this._channel = channel;
    // A new channel's data range has nothing to do with the old one's, so a
    // carried-over isovalue would usually mesh nothing at all.
    this._isovalue = null;
    this._showNegative = null;
  }

  setIsovalue(isovalue: number): void {
    this._isovalue = isovalue;
  }

  setShowNegative(show: boolean): void {
    this._showNegative = show;
  }

  /** A grid on the frame is a default visual layer, like atoms are. */
  matches(frame: Frame): boolean {
    return hasMeshableGrid(frame);
  }

  isApplicable(frame: Frame): boolean {
    return hasMeshableGrid(frame);
  }

  getCacheKey(): string {
    return `${super.getCacheKey()}:c=${this._channel ?? "auto"}:iv=${this._isovalue ?? "auto"}:neg=${this._showNegative ?? "auto"}`;
  }

  apply(input: Frame, ctx: PipelineContext): Frame {
    const channel = this._channel ?? pickChannel(input);
    if (!channel) return input;
    this._channel = channel;

    const field = readGridField(input, channel);
    if (!field) return input;

    if (this._isovalue === null) {
      this._isovalue = defaultIsovalueFor(channel, field.data);
    }
    if (this._showNegative === null) {
      this._showNegative = channelIsSigned(channel);
    }

    const parts: SurfacePart[] = [];
    const positive = marchingCubes(
      field.data,
      field.shape,
      field.cell,
      field.origin,
      this._isovalue,
      field.gridType,
    );
    if (positive.indices.length > 0) {
      parts.push({ mesh: positive, role: "primary" });
    }
    if (this._showNegative) {
      const negative = marchingCubes(
        field.data,
        field.shape,
        field.cell,
        field.origin,
        -this._isovalue,
        field.gridType,
      );
      if (negative.indices.length > 0) {
        parts.push({ mesh: negative, role: "complement" });
      }
    }

    ctx.surfaces.set(this.id, parts);
    return input;
  }
}

/** Prefer the channel a chemist most likely opened the file to look at. */
function pickChannel(frame: Frame): string | null {
  const channels = gridChannels(frame);
  if (channels.length === 0) return null;
  for (const preferred of ["density", "total"]) {
    if (channels.includes(preferred)) return preferred;
  }
  return channels[0];
}
