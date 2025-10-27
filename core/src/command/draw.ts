import type { Mesh, LinesMesh } from "@babylonjs/core";
import type { CommandExecutionContext } from "./base";
import { defineCommand } from "./base";
import type {
  DrawAtomInput,
  DrawBondInput,
  DrawBoxInput,
  DrawFrameInput
} from "../artist/types";
import type { ArtistBase } from "../artist/base";

const VIEW_ARTIST_NAME = "instanced";
const MESH_ARTIST_NAME = "dynamic";

const ensureArtist = (ctx: CommandExecutionContext, name: string): ArtistBase => {
  const artist = ctx.runtime.getArtist(name);
  if (!artist) {
    throw new Error(`Artist "${name}" is not registered.`);
  }
  return artist;
};

const toDrawAtomInput = (payload: unknown): DrawAtomInput => {
  if (!payload || typeof payload !== "object") {
    throw new Error("draw_atom expects an object payload.");
  }
  if (!("position" in (payload as Record<string, unknown>))) {
    throw new Error("draw_atom payload must include a position.");
  }
  return payload as DrawAtomInput;
};

const toDrawBondInput = (payload: unknown): DrawBondInput => {
  if (!payload || typeof payload !== "object") {
    throw new Error("draw_bond expects an object payload.");
  }
  if (!("start" in (payload as Record<string, unknown>)) || !("end" in (payload as Record<string, unknown>))) {
    throw new Error("draw_bond payload must include start and end positions.");
  }
  return payload as DrawBondInput;
};

const toDrawBoxInput = (payload: unknown): DrawBoxInput => {
  if (!payload || typeof payload !== "object") {
    throw new Error("draw_box expects an object payload.");
  }
  if (!("box" in (payload as Record<string, unknown>))) {
    throw new Error("draw_box payload must include box data.");
  }
  return payload as DrawBoxInput;
};

const toDrawFrameInput = (payload: unknown): DrawFrameInput => {
  if (!payload || typeof payload !== "object") {
    throw new Error("draw_frame expects an object payload.");
  }
  if (!("frame" in (payload as Record<string, unknown>))) {
    throw new Error("draw_frame payload must include a frame property.");
  }
  return payload as DrawFrameInput;
};

defineCommand("draw_atom", async (ctx, payload) => {
  const artist = ensureArtist(ctx, MESH_ARTIST_NAME);
  const mesh = await artist.invoke<Mesh>("draw_atom", toDrawAtomInput(payload));
  const meshes = mesh ? [mesh] : [];
  return {
    success: true,
    data: { meshName: mesh?.name, count: meshes.length },
    meshes,
    entities: [],
  };
});

defineCommand("delete_atom", async (ctx, payload) => {
  const artist = ensureArtist(ctx, MESH_ARTIST_NAME);
  const result = await artist.invoke<boolean>("delete_atom", payload);
  return {
    success: result,
    data: { atomId: payload.atomId },
    meshes: [],
    entities: [],
  };
});

defineCommand("draw_bond", async (ctx, payload) => {
  const artist = ensureArtist(ctx, MESH_ARTIST_NAME);
  const meshes = await artist.invoke<Mesh[]>("draw_bond", toDrawBondInput(payload));
  return {
    success: true,
    data: { count: meshes.length },
    meshes,
    entities: [],
  };
});

defineCommand("draw_box", async (ctx, payload) => {
  const artist = ensureArtist(ctx, MESH_ARTIST_NAME);
  const meshes = await artist.invoke<LinesMesh[]>("draw_box", toDrawBoxInput(payload));
  return {
    success: true,
    data: { count: meshes.length },
    meshes,
    entities: [],
  };
});

defineCommand("draw_frame", async (ctx, payload) => {
  const artist = ensureArtist(ctx, VIEW_ARTIST_NAME);
  const meshes = await artist.invoke<Mesh[]>("draw_frame", toDrawFrameInput(payload));
  return {
    success: true,
    data: { count: meshes.length },
    meshes,
    entities: [],
  };
});

defineCommand("clear", (ctx) => {
  ctx.app.world.clear();
  return { success: true, meshes: [], entities: [] };
});

defineCommand("set_style", () => {
  return { success: true, meshes: [], entities: [] };
});

defineCommand("set_theme", (_ctx, payload: { theme: string }) => {
  return { success: true, data: { theme: payload.theme }, meshes: [], entities: [] };
});

defineCommand("set_view_mode", (ctx, payload: { mode: string }) => {
  switch (payload.mode) {
    case "persp":
      ctx.app.world.setPerspective();
      break;
    case "ortho":
      ctx.app.world.setOrthographic();
      break;
    case "front":
      ctx.app.world.viewFront();
      break;
    case "back":
      ctx.app.world.viewBack();
      break;
    case "left":
      ctx.app.world.viewLeft();
      break;
    case "right":
      ctx.app.world.viewRight();
      break;
    default:
      break;
  }

  return { success: true, data: { mode: payload.mode }, meshes: [], entities: [] };
});

defineCommand("set_grid_size", (ctx, payload: { size: number }) => {
  ctx.app.world.gridGround.setSize(payload.size, payload.size);
  return { success: true, data: { size: payload.size }, meshes: [], entities: [] };
});

defineCommand(
  "enable_grid",
  (
    ctx,
    options: {
      mainColor?: string;
      lineColor?: string;
      opacity?: number;
      majorUnitFrequency?: number;
      minorUnitVisibility?: number;
      distanceThreshold?: number;
      minGridStep?: number;
      size?: number;
    } = {},
  ) => {
    const { world } = ctx.app;
    if (world.gridGround.isEnabled) {
      world.gridGround.disable();
    }
    world.gridGround.enable();

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

    return { success: true, data: options, meshes: [], entities: [] };
  },
);

defineCommand("disable_grid", (ctx) => {
  ctx.app.world.gridGround.disable();
  return { success: true, meshes: [], entities: [] };
});

defineCommand("is_grid_enabled", (ctx) => {
  const enabled = ctx.app.world.gridGround.isEnabled;
  return { success: true, data: { enabled }, meshes: [], entities: [] };
});
