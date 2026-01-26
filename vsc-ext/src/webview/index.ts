import { mountMolvis, type MolvisConfig, Frame } from "@molvis/core";
import { PdbReader, XyzReader, LammpsReader } from "molrs-wasm";

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
function detectFormat(filename: string): "pdb" | "xyz" | "lammps" | "unknown" {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === "pdb") return "pdb";
  if (ext === "xyz") return "xyz";
  if (ext === "lmp" || ext === "data" || ext === "lammps") return "lammps";
  return "unknown";
}

/**
 * Load and render a molecular file using molrs parsers
 */
function readFrame(content: string, format: "pdb" | "xyz" | "lammps"): ReturnType<PdbReader["read"]> {
  if (format === "pdb") {
    const reader = new PdbReader(content);
    const frame = reader.read(0);
    if (!frame) {
      throw new Error("Empty PDB file");
    }
    return frame;
  }
  if (format === "lammps") {
    const reader = new LammpsReader(content);
    const frame = reader.read(0);
    if (!frame) {
      throw new Error("Empty LAMMPS data file");
    }
    return frame;
  }
  const reader = new XyzReader(content);
  const frame = reader.read(0);
  if (!frame) {
    throw new Error("Empty XYZ file");
  }
  return frame;
}

function loadFile(content: string, filename: string) {
  const format = detectFormat(filename);

  if (format === "unknown") {
    throw new Error(`Unsupported file format: ${filename}`);
  }

  console.log(`Loading ${filename} as ${format.toUpperCase()} format`);

  const wasmFrame = readFrame(content, format);
  // WASM readers return Frame directly, no conversion needed
  const frame = wasmFrame;

  app.system.frame = frame;
  app.execute("draw_frame", { frame });
  app.setMode("view");

  console.log(`Loaded ${filename} successfully`);
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
