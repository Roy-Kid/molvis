import { Logger } from "tslog";
import { Molvis } from "@molvis/core/src/app";
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

export class JsonRpcHandler {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public async execute(request: JsonRPCRequest, buffers: DataView[] = []): Promise<JsonRPCResponse | undefined> {
    const { jsonrpc, method, id, params = {} } = request;
    
    // Validate JSON-RPC version
    if (jsonrpc !== "2.0") {
      logger.warn("Invalid JSON-RPC version:", { jsonrpc, method, id });
      return createErrorResponse(id, JsonRPCErrorCode.InvalidRequest, "Invalid Request: jsonrpc must be '2.0'");
    }
    
    // Check if method is supported
    if (!this.supportedMethods.includes(method)) {
      logger.warn("Unsupported method:", { method, id });
      return createErrorResponse(id, JsonRPCErrorCode.MethodNotFound, `Method not found: ${method}`);
    }
    
    try {
      // Execute the method
      const result = await this.callMethod(method, params, buffers);
      
      return createSuccessResponse(id, result);
    } catch (error) {
      logger.error("Method execution failed:", { method, params, error });
      return createErrorResponse(id, JsonRPCErrorCode.InternalError, `Internal error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async callMethod(method: string, params: any = {}, buffers: DataView[] = []): Promise<any> {
    if (method === "get_instance_count") {
      return MolvisWidget.getInstanceCount();
    }
    
    if (method === "clear_all_instances") {
      MolvisWidget.clearAllInstances();
      return { success: true };
    }
    
    if (method === "clear_all_content") {
      MolvisWidget.clearAllContent();
      return { success: true };
    }
    
    if (method === "enable_grid") {
      const result = await this.app.execute("enable_grid", params);
      return result;
    }
    
    // Dynamic method execution
    const result = await this.app.execute(method, params);
    return result;
  }

  private get supportedMethods(): string[] {
    return [
      // Core drawing commands (dynamically handled)
      'new_frame',
      'draw_frame', 
      'draw_box',
      'clear',
      
      // Style and theme (dynamically handled)
      'set_style',
      'set_theme',
      'set_view_mode',
      
      // Grid commands (dynamically handled, except enable_grid)
      'enable_grid',  // Special handling for enable/disable logic
      'disable_grid',
      'is_grid_enabled',
      'update_grid_appearance',
      'set_grid_size',
      
      // Instance management (frontend-only)
      'get_instance_count',
      'clear_all_instances',
      'clear_all_content',
      
      // Other commands (dynamically handled)
      'reset',
      'start',
      'stop',
      'resize'
    ];
  }
}
