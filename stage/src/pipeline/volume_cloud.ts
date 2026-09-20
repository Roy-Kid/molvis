/**
 * Volume cloud — every voxel of a grid as an additively-blended point sprite.
 *
 * Not a surface: it samples the field everywhere rather than extracting one
 * level set, so it cannot ride the shared `Draw surface` path and is its own
 * draw step. The old isosurface modifier folded this in as a `renderMode`;
 * splitting it means "surface plus cloud" is just both modifiers in the
 * pipeline, and either can be toggled or restyled alone.
 */

import type { Frame } from "@molcrafts/molvis-core/molrs";
import {
  gridChannels,
  hasMeshableGrid,
  readGridField,
} from "../algo/surface/grid_field";
import type { MolvisApp } from "../app";
import {
  DEFAULT_VOLUME_CLOUD_STYLE,
  type VolumeCloudStyle,
} from "../artist/surface/volume_cloud_renderer";
import { BaseModifier, ModifierCapability } from "./modifier";
import type { PipelineContext } from "./types";

export class VolumeCloudModifier extends BaseModifier {
  static readonly NAME = "Volume cloud";

  private _channel: string | null = null;
  private _style: VolumeCloudStyle = { ...DEFAULT_VOLUME_CLOUD_STYLE };
  private _app: MolvisApp | null = null;

  constructor(id = "volume-cloud") {
    super(id, VolumeCloudModifier.NAME, new Set([ModifierCapability.Draws]));
  }

  get channel(): string | null {
    return this._channel;
  }
  get style(): VolumeCloudStyle {
    return this._style;
  }

  setChannel(channel: string): void {
    this._channel = channel;
  }

  setStyle(patch: Partial<VolumeCloudStyle>): void {
    this._style = { ...this._style, ...patch };
  }

  /** Opt-in: the surface is the default view of a grid, not the cloud. */
  matches(_frame: Frame): boolean {
    return false;
  }

  isApplicable(frame: Frame): boolean {
    return hasMeshableGrid(frame);
  }

  getCacheKey(): string {
    const s = this._style;
    return `${super.getCacheKey()}:c=${this._channel ?? "auto"}:t=${s.threshold}:st=${s.stride}:pbc=${s.showPbcImages}`;
  }

  apply(input: Frame, ctx: PipelineContext): Frame {
    this._app = ctx.app;
    const channel = this._channel ?? gridChannels(input)[0];
    if (!channel) return input;
    this._channel = channel;

    const field = readGridField(input, channel);
    if (!field) {
      ctx.app.artist.cloudLayer(this.id).dispose();
      return input;
    }
    ctx.app.artist.drawVolumeCloud(this.id, field, this._style);
    return input;
  }

  applyVisibility(app: MolvisApp, visible: boolean): void {
    app.artist.cloudLayer(this.id).setVisible(visible);
  }

  onRemoved(): void {
    this._app?.artist.releaseCloudLayer(this.id);
    this._app = null;
  }
}
