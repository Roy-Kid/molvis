/**
 * Message types for communication between VSCode extension host and webview
 */

/**
 * Messages sent from Extension Host to Webview
 */
export type HostToWebviewMessage =
  | { type: "init"; mode: "standalone" | "editor" | "app"; config?: any }
  | { type: "loadFile"; content: string; filename: string }
  | { type: "error"; message: string };

/**
 * Messages sent from Webview to Extension Host
 */
export type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "fileDropped"; filename: string }
  | { type: "error"; message: string };
