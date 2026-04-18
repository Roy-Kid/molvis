/**
 * JSON-RPC router: dispatches inbound requests from a controller
 * (Python / other language) into `MolvisApp` commands and property
 * accessors. The single frontend router — no parallel anywidget copy.
 */

import { type Box, Frame } from "@molcrafts/molrs";
import type { MolvisApp } from "../../app";
import { ClassicTheme } from "../../artist/presets/classic";
import { ModernTheme } from "../../artist/presets/modern";
import { buildBox, buildFrame, decodeBinaryPayload } from "./serialization";
import type {
  JsonRPCRequest,
  RpcResponseEnvelope,
  SerializedBoxData,
  SerializedFrameData,
} from "./types";
import { createErrorResponse, createSuccessResponse } from "./types";

enum JsonRPCErrorCode {
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
    return Array.from(value as unknown as ArrayLike<number>, Number);
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
  app: MolvisApp,
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
  app: MolvisApp,
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
  app: MolvisApp,
  frame: Frame,
  box?: Box,
  manualAtomRadii: number[] | null = null,
): Promise<void> {
  app.artist.ribbonRenderer.dispose();
  app.commandManager.clearHistory();
  app.system.setFrame(frame, box);

  const options =
    manualAtomRadii && manualAtomRadii.length > 0
      ? { atoms: { radii: manualAtomRadii } }
      : undefined;
  const result = app.execute("draw_frame", {
    frame,
    box,
    options,
  });
  await Promise.resolve(result as void | Promise<void>);

  // Auto-fit camera so the molecule is visible
  app.world.resetCamera();
}

export class StandaloneRpcRouter {
  private readonly app: MolvisApp;
  private readonly handlers: Map<string, RpcHandler>;

  constructor(app: MolvisApp) {
    this.app = app;
    this.handlers = new Map<string, RpcHandler>([
      ["scene.new_frame", this.handleNewFrame],
      ["scene.draw_frame", this.handleDrawFrame],
      ["scene.draw_box", this.handleDrawBox],
      ["scene.clear", this.handleClear],
      ["scene.export_frame", this.handleExportFrame],
      ["selection.get", this.handleSelectionGet],
      ["selection.select_atoms", this.handleSelectionSelectAtoms],
      ["selection.clear", this.handleSelectionClear],
      [
        "selection.select_by_expression",
        this.handleSelectionSelectByExpression,
      ],
      ["snapshot.take", this.handleSnapshotTake],
      ["view.set_style", this.handleSetStyle],
      ["view.set_theme", this.handleSetTheme],
      ["view.set_mode", this.handleSetMode],
      ["state.get", this.handleStateGet],
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
      console.error("RPC execution failed", { method, error });
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

  private handleNewFrame: RpcHandler = (params) => {
    if (params.clear === false) {
      return { success: true };
    }
    return replaceCurrentFrame(this.app, new Frame()).then(() => ({
      success: true,
    }));
  };

  private handleDrawFrame: RpcHandler = (params, buffers) => {
    let frame: Frame;
    let box: Box | undefined;
    let manualAtomRadii: number[] | null;

    try {
      const decoded = decodeBinaryPayload(params, buffers) as Record<
        string,
        unknown
      >;
      // Accept both "frame"/"frameData" and "box"/"boxData" for compatibility
      const rawFrame = decoded.frame ?? decoded.frameData;
      if (!rawFrame) {
        throw invalidParams("scene.draw_frame requires a 'frame' payload");
      }
      const frameData = asRecord(rawFrame) as unknown as SerializedFrameData;
      const rawBox = decoded.box ?? decoded.boxData;
      const boxData = rawBox
        ? (asRecord(rawBox) as unknown as SerializedBoxData)
        : null;
      const options = asRecord(decoded.options);
      frame = buildFrame(frameData);
      box = boxData ? buildBox(boxData) : undefined;
      ({ manualAtomRadii } = applyStyle(this.app, options));
    } catch (error) {
      if (error instanceof RpcError) {
        throw error;
      }
      throw invalidParams(
        error instanceof Error ? error.message : String(error),
      );
    }

    return replaceCurrentFrame(this.app, frame, box, manualAtomRadii).then(
      () => ({ success: true }),
    );
  };

  private handleDrawBox: RpcHandler = (params, buffers) => {
    let box: Box;
    try {
      const decoded = decodeBinaryPayload(params, buffers) as Record<
        string,
        unknown
      >;
      const rawBox = decoded.box ?? decoded.boxData;
      if (!rawBox) {
        throw invalidParams("scene.draw_box requires a 'box' payload");
      }
      box = buildBox(asRecord(rawBox) as unknown as SerializedBoxData);
    } catch (error) {
      if (error instanceof RpcError) {
        throw error;
      }
      throw invalidParams(
        error instanceof Error ? error.message : String(error),
      );
    }

    this.app.execute("draw_box", { box });

    const currentFrame = this.app.frame;
    if (currentFrame) {
      this.app.system.updateCurrentFrame(currentFrame, box);
    }

    return { success: true };
  };

  private handleClear: RpcHandler = () => {
    return replaceCurrentFrame(this.app, new Frame()).then(() => ({
      success: true,
    }));
  };

  private handleExportFrame: RpcHandler = () => {
    const result = this.app.execute<
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
    this.app.execute("get_selected", {});

  private handleSelectionSelectAtoms: RpcHandler = (params) => {
    const ids = toIntegerIdList(params.ids ?? [], "ids");
    this.app.execute("select_atoms", { ids });
    return { success: true };
  };

  private handleSelectionClear: RpcHandler = () => {
    this.app.world.selectionManager.clearSelection();
    return { success: true };
  };

  private handleSelectionSelectByExpression: RpcHandler = (params) => {
    const expression =
      typeof params.expression === "string" ? params.expression : "";
    if (!expression) {
      throw invalidParams("expression must be a non-empty string");
    }
    const op = params.op;
    const mode: "replace" | "add" | "remove" | "toggle" =
      op === "add" || op === "remove" || op === "toggle" || op === "replace"
        ? op
        : "replace";
    this.app.world.selectionManager.selectByExpression(expression, mode);
    return { success: true };
  };

  private handleStateGet: RpcHandler = () => {
    const meta = this.app.world.selectionManager.getSelectedMeta();
    return {
      selection: {
        atom_ids: meta.atoms.atomId,
        bond_ids: meta.bonds.bondId,
      },
      mode: this.app.mode,
      frame_index: this.app.currentFrame,
      total_frames: this.app.system.trajectory?.length ?? 0,
    };
  };

  private handleSnapshotTake: RpcHandler = () =>
    this.app.execute("take_snapshot", {});

  private handleSetStyle: RpcHandler = (params, buffers) => {
    let manualAtomRadii: number[] | null;
    try {
      const decoded = decodeBinaryPayload(params, buffers) as Record<
        string,
        unknown
      >;
      ({ manualAtomRadii } = applyStyle(this.app, decoded));
    } catch (error) {
      if (error instanceof RpcError) {
        throw error;
      }
      throw invalidParams(
        error instanceof Error ? error.message : String(error),
      );
    }

    return rebuildCurrentFrame(this.app, manualAtomRadii).then(() => ({
      success: true,
    }));
  };

  private handleSetTheme: RpcHandler = (params) => {
    const frame = this.app.frame;
    const theme = params.theme;
    switch (theme) {
      case "classic":
      case "Classic":
        this.app.styleManager.setTheme(new ClassicTheme());
        break;
      case "modern":
      case "Modern":
        this.app.styleManager.setTheme(new ModernTheme());
        break;
      default:
        throw new Error(`Unsupported theme '${String(theme)}'`);
    }
    if (!frame) {
      return { success: true };
    }
    return rebuildCurrentFrame(this.app, null).then(() => ({
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
    this.app.setMode(mode);
    return { success: true };
  };
}
