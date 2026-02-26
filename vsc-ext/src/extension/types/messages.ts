/**
 * Message types for communication between VSCode extension host and webview.
 */

export type MolecularFilePayload = string | Record<string, string>;

/**
 * Messages sent from Extension Host to Webview.
 */
export type HostToWebviewMessage =
  | { type: "init"; mode: "standalone" | "editor" | "app"; config?: unknown }
  | { type: "loadFile"; content: MolecularFilePayload; filename: string }
  | { type: "error"; message: string };

/**
 * Messages sent from Webview to Extension Host.
 */
export type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "fileDropped"; filename: string }
  | { type: "error"; message: string };
