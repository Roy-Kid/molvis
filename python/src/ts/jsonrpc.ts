import type { Molvis } from "@molvis/core";
import { Logger } from "tslog";
import type { JsonRPCRequest, JsonRPCResponse } from "./types";
import { createErrorResponse, createSuccessResponse } from "./types";
import { MolvisWidget } from "./widget";

const logger = new Logger({ name: "molvis-jsonrpc" });

// JSON-RPC Error Code Enum
export enum JsonRPCErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ServerError = -32000,
}

// Widget-specific methods handled by frontend
const WIDGET_METHODS = new Set([
  "get_instance_count",
  "list_instances",
  "clear_all_instances",
  "clear_all_content",
]);

export class JsonRpcHandler {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public async execute(
    request: JsonRPCRequest,
    buffers: DataView[] = []
  ): Promise<JsonRPCResponse | undefined> {
    const { jsonrpc, method, id, params = {} } = request;

    // Validate JSON-RPC version
    if (jsonrpc !== "2.0") {
      logger.warn("Invalid JSON-RPC version:", { jsonrpc, method, id });
      return createErrorResponse(
        id,
        JsonRPCErrorCode.InvalidRequest,
        "Invalid Request: jsonrpc must be '2.0'"
      );
    }

    try {
      const result = await this.callMethod(method, params, buffers);
      return createSuccessResponse(id, result);
    } catch (error) {
      // Check if it's a "command not found" error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("not found") || errorMessage.includes("Unknown command")) {
        logger.warn("Method not found:", { method, id });
        return createErrorResponse(
          id,
          JsonRPCErrorCode.MethodNotFound,
          `Method not found: ${method}`
        );
      }

      logger.error("Method execution failed:", { method, params, error });
      return createErrorResponse(
        id,
        JsonRPCErrorCode.InternalError,
        `Internal error: ${errorMessage}`
      );
    }
  }

  private async callMethod(
    method: string,
    params: Record<string, unknown> = {},
    _buffers: DataView[] = []
  ): Promise<unknown> {
    // Handle widget-specific methods
    if (WIDGET_METHODS.has(method)) {
      return this.handleWidgetMethod(method);
    }

    // All other methods are delegated to core's command registry
    // This enables dynamic method discovery - if core supports it, we support it
    const result = await this.app.execute(method, params);
    return result;
  }

  private handleWidgetMethod(method: string): unknown {
    switch (method) {
      case "get_instance_count":
        return MolvisWidget.getInstanceCount();

      case "list_instances":
        return MolvisWidget.listInstances();

      case "clear_all_instances":
        MolvisWidget.clearAllInstances();
        return { success: true };

      case "clear_all_content":
        MolvisWidget.clearAllContent();
        return { success: true };

      default:
        throw new Error(`Unknown widget method: ${method}`);
    }
  }
}
