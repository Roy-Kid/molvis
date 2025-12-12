import { Color3 } from "@babylonjs/core";
import type { MolvisApp as Molvis } from "../core/app";
import { command } from "./decorator";

export interface GridOptions {
  mainColor?: string;
  lineColor?: string;
  opacity?: number;
  majorUnitFrequency?: number;
  minorUnitVisibility?: number;
  distanceThreshold?: number;
  minGridStep?: number;
  size?: number;
}

class GridCommands {
  @command("enable_grid")
  static enable_grid(app: Molvis, options?: GridOptions) {
    const { world } = app;
    if (world.gridGround.isEnabled) {
      world.gridGround.disable();
    }
    world.gridGround.enable();

    if (options) {
      const appearance: Record<string, unknown> = { ...options };
      if (options.mainColor) {
        appearance.mainColor = Color3.FromHexString(options.mainColor);
      }
      if (options.lineColor) {
        appearance.lineColor = Color3.FromHexString(options.lineColor);
      }

      if (Object.keys(appearance).length > 0) {
        world.gridGround.updateAppearance(appearance);
      }
    }

    return { success: true, data: options, meshes: [], entities: [] };
  }

  @command("disable_grid")
  static disable_grid(app: Molvis) {
    app.world.gridGround.disable();
    return { success: true, meshes: [], entities: [] };
  }

  @command("is_grid_enabled")
  static is_grid_enabled(app: Molvis) {
    const enabled = app.world.gridGround.isEnabled;
    return { success: true, data: { enabled }, meshes: [], entities: [] };
  }

  @command("set_grid_size")
  static set_grid_size(app: Molvis, size: number) {
    app.world.gridGround.setSize(size, size);
    return { success: true, data: { size }, meshes: [], entities: [] };
  }
}

export const enable_grid = GridCommands.enable_grid;
export const disable_grid = GridCommands.disable_grid;
export const is_grid_enabled = GridCommands.is_grid_enabled;
export const set_grid_size = GridCommands.set_grid_size;

