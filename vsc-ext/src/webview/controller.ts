import { type MolvisConfig, type Trajectory, mountMolvis } from "@molvis/core";
import type {
  HostToWebviewMessage,
  WebviewToHostMessage,
} from "../extension/types";
import {
  createRuntimeResources,
  freeRuntimeResources,
  loadMolecularPayload,
} from "./loader";

declare const acquireVsCodeApi: () => {
  postMessage: (message: WebviewToHostMessage) => void;
};

export function bootstrapWebview(container: HTMLElement): void {
  const app = mountMolvis(
    container,
    { showUI: true },
    {
      grid: { enabled: true },
    },
  );
  app.start();

  const resources = createRuntimeResources();
  const resizeObserver = new ResizeObserver(() => app.resize());
  resizeObserver.observe(container);

  const vscode = acquireVsCodeApi();

  // Override saveFile: encode blob as base64 and postMessage to extension host
  // (showSaveFilePicker is blocked in cross-origin webview iframes)
  app.saveFile = async (blob: Blob, suggestedName: string) => {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const data = btoa(binary);
    vscode.postMessage({ type: "saveFile", data, suggestedName });
  };

  window.addEventListener(
    "message",
    (event: MessageEvent<HostToWebviewMessage>) => {
      const message = event.data;
      switch (message.type) {
        case "init":
          if (message.config && typeof message.config === "object") {
            app.setConfig(message.config as Partial<MolvisConfig>);
          }
          break;
        case "loadFile":
          loadMolecularPayload(
            message.content,
            message.filename,
            {
              setTrajectory: (trajectory: Trajectory) =>
                app.setTrajectory(trajectory),
              setViewMode: () => app.setMode("view"),
              resetCamera: () => app.world.resetCamera(),
            },
            resources,
          );
          break;
        case "error":
          break;
        default:
          break;
      }
    },
  );

  container.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  container.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }

    vscode.postMessage({ type: "fileDropped", filename: file.name });
  });

  window.addEventListener("beforeunload", () => {
    freeRuntimeResources(resources);
    resizeObserver.disconnect();
    app.destroy();
  });

  vscode.postMessage({ type: "ready" });
}
