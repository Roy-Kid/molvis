import { mountMolvis, type MolvisConfig, Frame, AtomBlock } from "@molvis/core";
import { read_trajectory, read_frame } from "molrs-wasm";

const container = document.getElementById("molvis-container");
if (!container) throw new Error("Missing container");

const config: MolvisConfig = {
  fitContainer: true,
  showUI: true,
  grid: { enabled: true, mainColor: "#444", lineColor: "#666", opacity: 0.25, size: 10 }
};

const app = mountMolvis(container, config);
app.start();

const resizeObserver = new ResizeObserver(() => app.resize());
resizeObserver.observe(container);

// VSCode API for webview
declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
};

const vscode = acquireVsCodeApi();

// Message types
type HostToWebviewMessage =
  | { type: "init"; mode: "standalone" | "editor" }
  | { type: "loadFile"; content: string; filename: string }
  | { type: "error"; message: string };

type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "fileDropped"; filename: string }
  | { type: "error"; message: string };

let mode: "standalone" | "editor" = "standalone";

/**
 * Detect file format from filename extension
 */
function detectFormat(filename: string): "pdb" | "xyz" | "unknown" {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === "pdb") return "pdb";
  if (ext === "xyz") return "xyz";
  return "unknown";
}

/**
 * Load and render a molecular file using molrs parsers
 */
function loadFile(content: string, filename: string) {
  try {
    const format = detectFormat(filename);

    if (format === "unknown") {
      throw new Error(`Unsupported file format: ${filename}`);
    }

    console.log(`Loading ${filename} as ${format.toUpperCase()} format`);

    // Use unified read_frame function
    const mrFrame = read_frame(content, format);

    // Convert MrFrame to Frame (now zero-copy!)
    const frame = Frame.fromMrFrame(mrFrame);

    // Set frame to system
    app.system.frame = frame;

    // Draw the frame using Command
    app.execute("draw_frame", { frame });

    // Switch to View mode and render
    app.setMode("view");

    console.log(`Loaded ${frame.getAtomCount()} atoms from ${filename}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.postMessage({ type: "error", message: `Failed to load file: ${errorMessage}` });

    // Display error in UI
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; background: rgba(255, 0, 0, 0.8); padding: 20px; border-radius: 8px; font-family: sans-serif;";
    errorDiv.textContent = `Error: ${errorMessage}`;
    container.appendChild(errorDiv);
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
 * Drag and drop support for standalone mode
 */
if (mode === "standalone") {
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
      vscode.postMessage({ type: "fileDropped", filename: file.name });
    }
  });
}

// Cleanup
window.addEventListener("beforeunload", () => {
  resizeObserver.disconnect();
  app.destroy();
});

// Signal ready to extension host
vscode.postMessage({ type: "ready" });
