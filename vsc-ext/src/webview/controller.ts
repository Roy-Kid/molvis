import {
  type Molvis,
  type MolvisConfig,
  type MolvisSetting,
  type Trajectory,
  mountMolvis,
} from "@molvis/core";
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
  const resources = createRuntimeResources();
  const resizeObserver = new ResizeObserver(() => app.resize());
  resizeObserver.observe(container);

  const vscode = acquireVsCodeApi();

  const applyOptions = (config: unknown, settings: unknown): void => {
    if (config && typeof config === "object") {
      app.setConfig(config as Partial<MolvisConfig>);
    }

    if (settings && typeof settings === "object") {
      applyMolvisSettings(app, settings as Partial<MolvisSetting>);
    }
  };

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
          applyOptions(message.config, message.settings);
          break;
        case "applySettings":
          applyOptions(message.config, message.settings);
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
        case "triggerSave":
          app.save();
          break;
        case "error":
          break;
        default:
          break;
      }
    },
  );

  app.events.on("dirty-change", (isDirty: boolean) => {
    vscode.postMessage({ type: "dirtyStateChanged", isDirty });
  });

  container.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  container.addEventListener("drop", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      loadMolecularPayload(content, file.name, {
        setTrajectory: (trajectory: Trajectory) => app.setTrajectory(trajectory),
        setViewMode: () => app.setMode("view"),
        resetCamera: () => app.world.resetCamera(),
      }, resources);
    } catch (e) {
      console.error("Failed to load dropped file:", e);
    }
  });

  window.addEventListener("beforeunload", () => {
    freeRuntimeResources(resources);
    resizeObserver.disconnect();
    app.destroy();
  });

  // App start awaits renderer warmup internally.
  // Signal ready only after that gate passes.
  void app
    .start()
    .then(() => {
      vscode.postMessage({ type: "ready" });
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      vscode.postMessage({ type: "error", message });
    });
}

function applyMolvisSettings(
  app: Molvis,
  settings: Partial<MolvisSetting>,
): void {
  if (typeof settings.cameraPanSpeed === "number") {
    app.settings.setCameraPanSpeed(settings.cameraPanSpeed);
  }
  if (typeof settings.cameraRotateSpeed === "number") {
    app.settings.setCameraRotateSpeed(settings.cameraRotateSpeed);
  }
  if (typeof settings.cameraZoomSpeed === "number") {
    app.settings.setCameraZoomSpeed(settings.cameraZoomSpeed);
  }
  if (typeof settings.cameraInertia === "number") {
    app.settings.setCameraInertia(settings.cameraInertia);
  }
  if (typeof settings.cameraPanInertia === "number") {
    app.settings.setCameraPanInertia(settings.cameraPanInertia);
  }
  if (typeof settings.cameraMinRadius === "number") {
    app.settings.setCameraMinRadius(settings.cameraMinRadius);
  }
  if (
    settings.cameraMaxRadius === null ||
    typeof settings.cameraMaxRadius === "number"
  ) {
    app.settings.setCameraMaxRadius(settings.cameraMaxRadius);
  }
  if (settings.grid && typeof settings.grid === "object") {
    app.settings.setGrid(
      settings.grid as Parameters<typeof app.settings.setGrid>[0],
    );
  }
  if (settings.graphics && typeof settings.graphics === "object") {
    app.settings.setGraphics(
      settings.graphics as Parameters<typeof app.settings.setGraphics>[0],
    );
  }
}
