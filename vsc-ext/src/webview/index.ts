import { Frame, type MolvisConfig, mountMolvis, readFrame } from "@molvis/core";

const container = document.getElementById("molvis-container");
if (!container) throw new Error("Missing container");

const config: MolvisConfig = {
  showUI: true,
};

const settings = {
  grid: {
    enabled: true,
    mainColor: "#444",
    lineColor: "#666",
    opacity: 0.25,
    size: 10,
  },
};

const app = mountMolvis(container, config, settings);
app.start();

const resizeObserver = new ResizeObserver(() => app.resize());
resizeObserver.observe(container);

// VSCode API for webview
declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
};

const vscode = acquireVsCodeApi();

// Message types (re-declare here or import if shared build allows, currently inlined in original file)
type HostToWebviewMessage =
  | { type: "init"; mode: "standalone" | "editor" | "app"; config?: any }
  | { type: "loadFile"; content: string; filename: string }
  | { type: "error"; message: string };

type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "fileDropped"; filename: string }
  | { type: "error"; message: string };

let mode: "standalone" | "editor" | "app" = "standalone";

function loadFile(content: string, filename: string) {
  console.log(`Loading ${filename}...`);

  try {
    const frame = readFrame(content, filename);

    if (!frame) throw new Error("Frame is undefined");

    app.system.frame = frame;
    app.execute("draw_frame", { frame });

    // Reset view mode on new file load
    app.setMode("view");
    // Fit to screen
    app.execute("reset_camera", {});

    console.log(`Loaded ${filename} successfully`);
  } catch (e) {
    console.error("Failed to load file:", e);
    // Optionally notify host of error
    // vscode.postMessage({ type: "error", message: String(e) });
  }
}

/**
 * Handle messages from extension host
 */
window.addEventListener("message", (event) => {
  const message: HostToWebviewMessage = event.data;

  switch (message.type) {
    case "init":
      mode = message.mode;
      console.log(`MolVis initialized in ${mode} mode`);

      // Apply config if provided (e.g. showUI)
      if (message.config) {
        app.setConfig(message.config);
      }
      break;

    case "loadFile":
      loadFile(message.content, message.filename);
      break;

    case "error":
      console.error("Error from extension host:", message.message);
      break;
  }
});

/**
 * Drag and drop support
 * Enabled for all modes to allow dropping files onto preview/page
 */
container.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

container.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    // Notify host to read the file
    vscode.postMessage({ type: "fileDropped", filename: file.name });
  }
});

// Cleanup
window.addEventListener("beforeunload", () => {
  resizeObserver.disconnect();
  app.destroy();
});

// Signal ready to extension host
vscode.postMessage({ type: "ready" });
