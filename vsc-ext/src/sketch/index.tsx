import { createRoot } from "react-dom/client";
import { MolvisSketch } from "@/ui/modes/edit/MolvisSketch";
import type { WebviewToHostMessage } from "../extension/types";
import "../viewer/main.css";

declare const acquireVsCodeApi: () => {
  postMessage: (message: WebviewToHostMessage) => void;
};

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)),
    );
  }
  return btoa(chunks.join(""));
}

const vscode = acquireVsCodeApi();
document.documentElement.classList.add("dark");

const root = document.getElementById("root");
if (!root) {
  throw new Error("MolVis Sketch root is missing");
}

createRoot(root).render(
  <main className="h-full bg-background p-2 text-foreground">
    <MolvisSketch
      allowPopout={false}
      className="h-full"
      minHeight={0}
      onExportFile={async (blob, suggestedName) => {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        vscode.postMessage({
          type: "saveFile",
          data: bytesToBase64(bytes),
          suggestedName,
        });
      }}
    />
  </main>,
);
