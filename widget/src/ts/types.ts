import type { AnyModel } from "@anywidget/types";

// Widget configuration interface
export interface WidgetConfig {
  width: number;
  height: number;
  session_id: number;
  showUI?: boolean;
  uiComponents?: UIConfig;
}

// UI component configuration
export interface UIConfig {
  showModeIndicator: boolean;
  showViewIndicator: boolean;
  showInfoPanel: boolean;
  showFrameIndicator: boolean;
}

// UI layer configuration
export interface UILayerConfig {
  canvas: { zIndex: number; pointerEvents: string };
  ui: { zIndex: number; pointerEvents: string };
  modeIndicator: { zIndex: number; pointerEvents: string };
  viewIndicator: { zIndex: number; pointerEvents: string };
  infoPanel: { zIndex: number; pointerEvents: string };
  frameIndicator: { zIndex: number; pointerEvents: string };
}

// Size configuration
export interface SizeConfig {
  width: number;
  height: number;
  pixelRatio: number;
}

// Widget model type
export interface ModelType {
  get(key: string): any;
  set(key: string, value: any): void;
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
  send(event: string, data: any): void;
  save_changes(): void;
}

// JSON-RPC related types
export interface JsonRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, any>;
  id: number;
}

export interface JsonRPCResponse {
  jsonrpc: "2.0";
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface JsonRPCError {
  code: number;
  message: string;
  data?: any;
}

// Responsive breakpoints
export interface BreakpointConfig {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

// Utility functions
export type SafeQuerySelector<T extends HTMLElement = HTMLElement> = (
  parent: Element,
  selector: string
) => T | null;

// JSON-RPC utility functions
export function createSuccessResponse(id: number, result: any): JsonRPCResponse {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

export function createErrorResponse(id: number | null, code: number, message: string, data?: any): JsonRPCResponse {
  return {
    jsonrpc: "2.0",
    id: id || 0,
    error: {
      code,
      message,
      data
    }
  };
}

// Default configurations
export const DEFAULT_UI_LAYERS: UILayerConfig = {
  canvas: { zIndex: 1, pointerEvents: 'auto' },
  ui: { zIndex: 1000, pointerEvents: 'none' },
  modeIndicator: { zIndex: 1001, pointerEvents: 'auto' },
  viewIndicator: { zIndex: 1001, pointerEvents: 'auto' },
  infoPanel: { zIndex: 1001, pointerEvents: 'auto' },
  frameIndicator: { zIndex: 1001, pointerEvents: 'auto' }
};

export const DEFAULT_BREAKPOINTS: BreakpointConfig = {
  xs: 480,
  sm: 768,
  md: 1024,
  lg: 1200,
  xl: 1400
};