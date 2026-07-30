import type { Molvis } from "@molvis/stage";
import { buildStructureOutline } from "@molvis/stage";
import {
  type FileContent,
  type FileFormat,
  type LoadMode,
  loadFileContent,
} from "@molvis/stage/io";
import { useEffect } from "react";

interface VsCodeApi {
  postMessage: (message: unknown) => void;
}

declare global {
  interface Window {
    __molvisVsCodeApi?: VsCodeApi;
  }
  const acquireVsCodeApi: (() => VsCodeApi) | undefined;
}

function getVsCodeApi(): VsCodeApi | null {
  if (typeof window === "undefined") return null;
  if (window.__molvisVsCodeApi) return window.__molvisVsCodeApi;
  if (typeof acquireVsCodeApi !== "function") return null;
  try {
    window.__molvisVsCodeApi = acquireVsCodeApi();
    return window.__molvisVsCodeApi;
  } catch {
    return null;
  }
}

function postStructureOutline(app: Molvis, vscode: VsCodeApi): void {
  const frame = app.system.frame;
  if (!frame) {
    vscode.postMessage({
      type: "structureOutline",
      outline: { roots: [] },
    });
    return;
  }
  const outline = buildStructureOutline(frame);
  vscode.postMessage({
    type: "structureOutline",
    outline,
  });
}

/**
 * Bridges the React page to a VSCode-like host. When `acquireVsCodeApi`
 * is available, posts a single `ready` message on mount (so the host
 * knows to push `loadFile` back) and routes inbound `loadFile` /
 * `selectAtoms` messages. Posts `structureOutline` after each frame
 * render so the native Outline tree can refresh. When not in a VSCode
 * webview, this is a no-op.
 */
export function useHostFileBridge(app: Molvis | null): void {
  useEffect(() => {
    if (!app) return;
    const vscode = getVsCodeApi();
    if (!vscode) return;

    vscode.postMessage({ type: "ready" });

    const onFrameRendered = (_payload: {
      frame: unknown;
      box?: unknown;
    }): void => {
      postStructureOutline(app, vscode);
    };
    app.events.on("frame-rendered", onFrameRendered);
    // Seed once in case a frame is already present.
    postStructureOutline(app, vscode);

    const handler = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      const message = data as { type?: string };

      if (message.type === "selectAtoms") {
        const { indices } = message as { indices?: number[] };
        if (!Array.isArray(indices) || indices.length === 0) return;
        app.world.selectionManager.replaceAtomsByIds(indices);
        return;
      }

      if (message.type !== "loadFile") return;
      const { content, filename, format, mode } = message as {
        content: FileContent;
        filename: string;
        format?: FileFormat;
        mode?: LoadMode;
      };
      loadFileContent(app, content, filename, format, mode ?? "replace").catch(
        (err: unknown) => {
          const text = err instanceof Error ? err.message : String(err);
          app.events.emit("status-message", {
            text: `Failed to load ${filename}: ${text}`,
            type: "error",
          });
        },
      );
    };

    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      app.events.off("frame-rendered", onFrameRendered);
    };
  }, [app]);
}
