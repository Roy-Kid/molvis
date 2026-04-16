import { type Box, Frame } from "@molcrafts/molrs";
import type { Molvis as MolvisApp } from "@molvis/core";
import {
  ClassicTheme,
  ColorByPropertyModifier,
  ModernTheme,
  getPaletteDefinition,
  listPaletteDefinitions,
} from "@molvis/core";
import { Logger } from "tslog";
import { buildBox, buildFrame, decodeBinaryPayload } from "./serialization";
import type {
  JsonRPCRequest,
  RpcResponseEnvelope,
  SerializedBoxData,
  SerializedFrameData,
} from "./types";
import { createErrorResponse, createSuccessResponse } from "./types";
import { MolvisSessionRegistry, type MolvisSessionRuntime } from "./widget";

const logger = new Logger({ name: "molvis-jsonrpc" });

export enum JsonRPCErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
}

class RpcError extends Error {
  public readonly code: JsonRPCErrorCode;
  public readonly data?: unknown;

  constructor(code: JsonRPCErrorCode, message: string, data?: unknown) {
    super(message);
    this.name = "RpcError";
    this.code = code;
    this.data = data;
  }
}

type RpcHandler = (
  params: Record<string, unknown>,
  buffers: DataView[],
) => Promise<unknown> | unknown;

const LEGACY_ALIASES: Record<string, string> = {
  new_frame: "scene.new_frame",
  draw_frame: "scene.draw_frame",
  draw_box: "scene.draw_box",
  clear: "scene.clear",
  clear_scene: "scene.clear",
  export_frame: "scene.export_frame",
  get_selected: "selection.get",
  select_atoms: "selection.select_atoms",
  take_snapshot: "snapshot.take",
  set_style: "view.set_style",
  set_theme: "view.set_theme",
  set_view_mode: "view.set_mode",
  get_instance_count: "session.get_session_count",
  list_instances: "session.list_sessions",
  clear_all_instances: "session.clear_all_sessions",
  clear_all_content: "session.clear_all_content",
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function invalidParams(message: string, data?: unknown): RpcError {
  return new RpcError(JsonRPCErrorCode.InvalidParams, message, data);
}

function invalidRequest(message: string, data?: unknown): RpcError {
  return new RpcError(JsonRPCErrorCode.InvalidRequest, message, data);
}

function parseError(message: string, data?: unknown): RpcError {
  return new RpcError(JsonRPCErrorCode.ParseError, message, data);
}

function ensureFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw invalidParams(`${label} must be a finite number`);
  }
  return value;
}

function toRepresentationName(style: unknown): string | null {
  switch (style) {
    case "ball_and_stick":
      return "Ball and Stick";
    case "spacefill":
      return "Spacefill";
    case "wireframe":
      return "Stick";
    default:
      return null;
  }
}

function toNumberArray(value: unknown): number[] | null {
  if (ArrayBuffer.isView(value)) {
    return Array.from(value as ArrayLike<number>, Number);
  }
  if (!Array.isArray(value)) {
    return null;
  }
  if (
    !value.every((item) => typeof item === "number" && Number.isFinite(item))
  ) {
    return null;
  }
  return value as number[];
}

function toIntegerIdList(value: unknown, label: string): number[] {
  const values = toNumberArray(value);
  if (!values) {
    throw invalidParams(`${label} must be an array of integer ids`);
  }
  if (!values.every((item) => Number.isInteger(item) && item >= 0)) {
    throw invalidParams(`${label} must contain only non-negative integers`);
  }
  return values;
}

function applyStyle(
  app: Molvis,
  params: Record<string, unknown>,
): { manualAtomRadii: number[] | null } {
  const styleName = toRepresentationName(params.style);
  if (params.style != null && !styleName) {
    throw invalidParams(
      "style must be one of 'ball_and_stick', 'spacefill', or 'wireframe'",
    );
  }
  if (styleName) {
    app.setRepresentation(styleName);
  }

  const atoms = asRecord(params.atoms);
  const bonds = asRecord(params.bonds);
  let manualAtomRadii: number[] | null = null;

  if (atoms.radius != null) {
    if (typeof atoms.radius === "number") {
      app.styleManager.setAtomRadiusScale(
        ensureFiniteNumber(atoms.radius, "atoms.radius"),
      );
    } else {
      manualAtomRadii = toNumberArray(atoms.radius);
      if (!manualAtomRadii) {
        throw invalidParams(
          "atoms.radius must be a finite number or an array of finite numbers",
        );
      }
    }
  }

  if (bonds.radius != null) {
    app.styleManager.setBondRadiusScale(
      ensureFiniteNumber(bonds.radius, "bonds.radius"),
    );
  }

  return { manualAtomRadii };
}

function rebuildCurrentFrame(
  app: Molvis,
  manualAtomRadii: number[] | null,
): Promise<void> {
  const frame = app.frame;
  if (!frame) {
    return Promise.resolve();
  }

  if (manualAtomRadii && manualAtomRadii.length > 0) {
    const result = app.execute("draw_frame", {
      frame,
      box: app.system.box,
      options: { atoms: { radii: manualAtomRadii } },
    });
    return Promise.resolve(result as void | Promise<void>);
  }

  const result = app.execute("draw_frame", {
    frame,
    box: app.system.box,
  });
  return Promise.resolve(result as void | Promise<void>);
}

async function replaceCurrentFrame(
  app: Molvis,
  frame: Frame,
  box?: Box,
): Promise<void> {
  await app.loadFrame(frame, box);
}

export class JsonRpcRouter {
  private readonly runtime: MolvisSessionRuntime;
  private readonly handlers: Map<string, RpcHandler>;

  constructor(runtime: MolvisSessionRuntime) {
    this.runtime = runtime;
    this.handlers = new Map<string, RpcHandler>([
      ["scene.new_frame", this.handleNewFrame],
      ["scene.draw_frame", this.handleDrawFrame],
      ["scene.draw_box", this.handleDrawBox],
      ["scene.clear", this.handleClear],
      ["scene.export_frame", this.handleExportFrame],
      ["selection.get", this.handleSelectionGet],
      ["selection.select_atoms", this.handleSelectionSelectAtoms],
      ["snapshot.take", this.handleSnapshotTake],
      ["view.set_style", this.handleSetStyle],
      ["view.set_theme", this.handleSetTheme],
      ["view.set_mode", this.handleSetMode],
      ["view.set_background", this.handleSetBackground],
      ["view.color_by", this.handleColorBy],
      ["session.get_session_count", this.handleSessionCount],
      ["session.list_sessions", this.handleListSessions],
      ["session.clear_all_sessions", this.handleClearAllSessions],
      ["session.clear_all_content", this.handleClearAllContent],
      ["overlay.add", this.handleOverlayAdd],
      ["overlay.remove", this.handleOverlayRemove],
      ["overlay.update", this.handleOverlayUpdate],
      ["overlay.clear", this.handleOverlayClear],
      ["palette.list", this.handlePaletteList],
      ["palette.get", this.handlePaletteGet],
    ]);
  }

  public async execute(
    request: unknown,
    buffers: DataView[] = [],
  ): Promise<RpcResponseEnvelope> {
    let parsed: JsonRPCRequest;
    try {
      parsed = this.parseRequest(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof RpcError) {
        return {
          content: createErrorResponse(
            null,
            error.code,
            error.message,
            error.data,
          ),
        };
      }
      return {
        content: createErrorResponse(
          null,
          JsonRPCErrorCode.InvalidRequest,
          message,
        ),
      };
    }

    const method = LEGACY_ALIASES[parsed.method] ?? parsed.method;
    const handler = this.handlers.get(method);

    if (!handler) {
      return {
        content: createErrorResponse(
          parsed.id,
          JsonRPCErrorCode.MethodNotFound,
          `Method not found: ${parsed.method}`,
        ),
      };
    }

    try {
      const result = await handler(asRecord(parsed.params), buffers);
      return {
        content: createSuccessResponse(parsed.id, result),
      };
    } catch (error) {
      if (error instanceof RpcError) {
        return {
          content: createErrorResponse(
            parsed.id,
            error.code,
            error.message,
            error.data,
          ),
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      logger.error("RPC execution failed", {
        session: this.runtime.sessionKey,
        method,
        error,
      });
      return {
        content: createErrorResponse(
          parsed.id,
          JsonRPCErrorCode.InternalError,
          message,
        ),
      };
    }
  }

  private parseRequest(request: unknown): JsonRPCRequest {
    let candidate = request;
    if (typeof request === "string") {
      try {
        candidate = JSON.parse(request) as unknown;
      } catch (error) {
        throw parseError("Malformed JSON-RPC payload", {
          cause: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (typeof candidate !== "object" || candidate === null) {
      throw invalidRequest("JSON-RPC payload must be an object");
    }

    const parsed = candidate as Partial<JsonRPCRequest>;
    if (parsed.jsonrpc !== "2.0" || typeof parsed.method !== "string") {
      throw invalidRequest("Invalid JSON-RPC request");
    }
    if (typeof parsed.id !== "number") {
      throw invalidRequest("JSON-RPC requests must include a numeric id");
    }

    return {
      jsonrpc: "2.0",
      id: parsed.id,
      method: parsed.method,
      params: asRecord(parsed.params),
    };
  }

  private handleNewFrame: RpcHandler = async (params) => {
    if (params.clear === false) {
      return { success: true };
    }
    await replaceCurrentFrame(this.runtime.app, new Frame());
    return { success: true };
  };

  private handleDrawFrame: RpcHandler = async (params, buffers) => {
    let frame: Frame;
    let box: Box | undefined;
    let manualAtomRadii: number[] | null;
    let colorByOpts: { column: string; colormap: string } | null = null;

    try {
      const decoded = decodeBinaryPayload(params, buffers) as Record<
        string,
        unknown
      >;
      if (!decoded.frame) {
        throw invalidParams("scene.draw_frame requires a 'frame' payload");
      }
      const frameData = asRecord(decoded.frame) as SerializedFrameData;
      const boxData = decoded.box
        ? (asRecord(decoded.box) as SerializedBoxData)
        : null;
      const options = asRecord(decoded.options);
      frame = buildFrame(frameData);
      box = boxData ? buildBox(boxData) : undefined;
      ({ manualAtomRadii } = applyStyle(this.runtime.app, options));

      if (options.color_by != null) {
        const cb = asRecord(options.color_by);
        colorByOpts = {
          column: String(cb.column ?? ""),
          colormap: (cb.colormap as string) ?? "viridis",
        };
      }
    } catch (error) {
      if (error instanceof RpcError) {
        throw error;
      }
      throw invalidParams(
        error instanceof Error ? error.message : String(error),
      );
    }

    // Per-draw color_by: apply before loading (scene.color_by overrides this)
    if (colorByOpts?.column) {
      const mod = new ColorByPropertyModifier("draw-color-by");
      mod.columnName = colorByOpts.column;
      mod.colormap = colorByOpts.colormap;
      frame = mod.apply(frame, {} as never);
    }

    await replaceCurrentFrame(this.runtime.app, frame, box);

    // Persistent pipeline (scene.color_by) always runs last — overrides per-draw
    if (this.runtime.app.modifierPipeline.getModifiers().length > 0) {
      await this.runtime.app.applyPipeline({ fullRebuild: true });
    }

    return { success: true };
  };

  private handleDrawBox: RpcHandler = (params, buffers) => {
    let box: Box;
    try {
      const decoded = decodeBinaryPayload(params, buffers) as Record<
        string,
        unknown
      >;
      if (!decoded.box) {
        throw invalidParams("scene.draw_box requires a 'box' payload");
      }
      box = buildBox(asRecord(decoded.box) as SerializedBoxData);
    } catch (error) {
      if (error instanceof RpcError) {
        throw error;
      }
      throw invalidParams(
        error instanceof Error ? error.message : String(error),
      );
    }

    this.runtime.app.execute("draw_box", { box });

    const currentFrame = this.runtime.app.frame;
    if (currentFrame) {
      this.runtime.app.system.updateCurrentFrame(currentFrame, box);
    }

    return { success: true };
  };

  private handleClear: RpcHandler = async () => {
    this.runtime.app.reset();
    return { success: true };
  };

  private handleExportFrame: RpcHandler = () => {
    const result = this.runtime.app.execute<
      Record<string, never>,
      {
        frameData: {
          blocks: Record<string, Record<string, unknown>>;
          metadata: Record<string, unknown>;
        };
      }
    >("export_frame", {});
    const resolved =
      result instanceof Promise ? result : Promise.resolve(result);
    return resolved.then((value) => ({
      frame: value.frameData,
    }));
  };

  private handleSelectionGet: RpcHandler = () =>
    this.runtime.app.execute("get_selected", {});

  private handleSelectionSelectAtoms: RpcHandler = (params) => {
    const ids = toIntegerIdList(params.ids ?? [], "ids");
    this.runtime.app.execute("select_atoms", { ids });
    return { success: true };
  };

  private handleSnapshotTake: RpcHandler = () =>
    this.runtime.app.execute("take_snapshot", {});

  private handleSetStyle: RpcHandler = (params, buffers) => {
    let manualAtomRadii: number[] | null;
    try {
      const decoded = decodeBinaryPayload(params, buffers) as Record<
        string,
        unknown
      >;
      ({ manualAtomRadii } = applyStyle(this.runtime.app, decoded));
    } catch (error) {
      if (error instanceof RpcError) {
        throw error;
      }
      throw invalidParams(
        error instanceof Error ? error.message : String(error),
      );
    }

    return rebuildCurrentFrame(this.runtime.app, manualAtomRadii).then(() => ({
      success: true,
    }));
  };

  private handleSetTheme: RpcHandler = (params) => {
    const frame = this.runtime.app.frame;
    const theme = params.theme;
    switch (theme) {
      case "classic":
      case "Classic":
        this.runtime.app.styleManager.setTheme(new ClassicTheme());
        break;
      case "modern":
      case "Modern":
        this.runtime.app.styleManager.setTheme(new ModernTheme());
        break;
      default:
        throw new Error(`Unsupported theme '${String(theme)}'`);
    }
    if (!frame) {
      return { success: true };
    }
    return rebuildCurrentFrame(this.runtime.app, null).then(() => ({
      success: true,
    }));
  };

  private handleSetMode: RpcHandler = (params) => {
    const mode = String(params.mode ?? "");
    if (!["view", "select", "edit", "measure", "manipulate"].includes(mode)) {
      throw invalidParams(
        "mode must be one of 'view', 'select', 'edit', 'measure', or 'manipulate'",
      );
    }
    this.runtime.app.setMode(mode);
    return { success: true };
  };

  private handleSetBackground: RpcHandler = (params) => {
    const color = String(params.color ?? "#000000FF");
    this.runtime.app.setBackgroundColor(color);
    return { success: true };
  };

  private handleColorBy: RpcHandler = async (params) => {
    const app = this.runtime.app;
    const column = params.column != null ? String(params.column) : null;

    // Remove existing ColorByPropertyModifier if any
    const existing = app.modifierPipeline
      .getModifiers()
      .find((m) => m instanceof ColorByPropertyModifier);
    if (existing) {
      app.modifierPipeline.removeModifier(existing.id);
    }

    // "element" or null → default CPK coloring (no modifier needed)
    if (column == null || column === "element") {
      if (app.frame) {
        await app.applyPipeline({ fullRebuild: true });
      }
      return { success: true };
    }

    const modifier = new ColorByPropertyModifier("color-by-rpc");
    modifier.columnName = column;
    modifier.colormap = (params.colormap as string) ?? "viridis";
    modifier.clampOutOfRange = params.clamp !== false;
    if (
      params.range != null &&
      typeof params.range === "object" &&
      "min" in (params.range as object) &&
      "max" in (params.range as object)
    ) {
      const r = params.range as { min: number; max: number };
      modifier.range = { min: r.min, max: r.max };
    }

    app.modifierPipeline.addModifier(modifier);
    if (app.frame) {
      await app.applyPipeline({ fullRebuild: true });
    }
    return { success: true };
  };

  private handleSessionCount: RpcHandler = () =>
    MolvisSessionRegistry.getSessionCount();

  private handleListSessions: RpcHandler = () =>
    MolvisSessionRegistry.listSessions();

  private handleClearAllSessions: RpcHandler = () => {
    MolvisSessionRegistry.clearAllSessions();
    return { success: true };
  };

  private handleClearAllContent: RpcHandler = () => {
    MolvisSessionRegistry.clearAllContent();
    return { success: true };
  };

  private handleOverlayAdd: RpcHandler = (params) => {
    this.runtime.app.execute("add_overlay", params);
    return { success: true };
  };

  private handleOverlayRemove: RpcHandler = (params) => {
    const id = String(params.id ?? "");
    if (!id) {
      throw invalidParams("overlay.remove requires an 'id'");
    }
    this.runtime.app.execute("remove_overlay", { id });
    return { success: true };
  };

  private handleOverlayUpdate: RpcHandler = (params) => {
    const id = String(params.id ?? "");
    if (!id) {
      throw invalidParams("overlay.update requires an 'id'");
    }
    const patch = asRecord(params.patch);
    this.runtime.app.execute("update_overlay", { id, patch });
    return { success: true };
  };

  private handleOverlayClear: RpcHandler = () => {
    this.runtime.app.overlayManager.clear();
    return { success: true };
  };

  private handlePaletteList: RpcHandler = () => {
    try {
      const result = listPaletteDefinitions();
      return result;
    } catch (error) {
      logger.error("[palette.list] error", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  private handlePaletteGet: RpcHandler = (params) => {
    try {
      const name = params.name;
      if (typeof name !== "string") {
        throw new RpcError(
          JsonRPCErrorCode.InvalidParams,
          "palette.get requires a 'name' string parameter",
        );
      }
      const result = getPaletteDefinition(name);
      return result;
    } catch (error) {
      logger.error("[palette.get] error", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}
