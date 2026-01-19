/**
 * Widget-specific type definitions.
 * Note: Some types like MolvisConfig extend core types with widget-specific settings.
 */

import type { MolvisConfig as CoreMolvisConfig } from "@molvis/core";

// Re-export core config for convenience
export type { CoreMolvisConfig };

// Widget configuration interface (extends core config conceptually)
export interface WidgetConfig {
  name?: string;  // Named scene identifier
  width: number;
  height: number;
  session_id?: number;  // Legacy, prefer name
  showUI?: boolean;
}

// Widget model type (anywidget interface)
export interface ModelType {
  get<T = unknown>(key: string): T;
  set<T = unknown>(key: string, value: T): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback: (...args: unknown[]) => void): void;
  send(event: string, data: unknown): void;
  save_changes(): void;
}

// JSON-RPC related types
export interface JsonRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
  id: number;
}

export interface JsonRPCResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface JsonRPCError {
  code: number;
  message: string;
  data?: unknown;
}

// JSON-RPC utility functions
export function createSuccessResponse(id: number, result: unknown): JsonRPCResponse {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

export function createErrorResponse(
  id: number | null,
  code: number,
  message: string,
  data?: unknown
): JsonRPCResponse {
  return {
    jsonrpc: "2.0",
    id: id || 0,
    error: {
      code,
      message,
      data,
    },
  };
}
