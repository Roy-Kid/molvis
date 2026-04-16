/**
 * Widget-specific type definitions.
 */

import type { AnyModel } from "@anywidget/types";

export interface MolvisModelState {
  name: string;
  width: number;
  height: number;
  background: string;
  ready: boolean;
  _last_error: string;
}

export type MolvisModel = AnyModel<MolvisModelState>;

export interface JsonRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
  id: number;
}

export interface JsonRPCResponse {
  jsonrpc: "2.0";
  id: number | null;
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

export interface BinaryBufferRef {
  __molvis_buffer__: true;
  index: number;
  dtype: string;
  shape: number[];
}

export interface SerializedFrameData {
  blocks: Record<string, Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}

export interface SerializedBoxData {
  matrix: unknown;
  origin: unknown;
  pbc?: boolean[];
}

export interface RpcResponseEnvelope {
  content: JsonRPCResponse;
  buffers?: ArrayBuffer[];
}

export function createSuccessResponse(
  id: number | null,
  result: unknown,
): JsonRPCResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? 0,
    result,
  };
}

export function createErrorResponse(
  id: number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRPCResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? 0,
    error: {
      code,
      message,
      data,
    },
  };
}
