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

// Responsive breakpoints
export interface BreakpointConfig {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

// Molvis Configuration Interface
export interface MolvisConfig {
  // Display settings
  displayWidth: number;
  displayHeight: number;
  fitContainer: boolean;

  // Render settings
  autoRenderResolution: boolean;
  renderWidth?: number;
  renderHeight?: number;
  pixelRatio: number;

  // UI settings
  showUI: boolean;
  uiComponents: UIConfig;

  // Performance settings
  enableVSync: boolean;
  enableMSAA: boolean;
  maxFPS: number;
}

// Utility functions
export type SafeQuerySelector<T extends HTMLElement = HTMLElement> = (
  parent: Element,
  selector: string
) => T | null;

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
