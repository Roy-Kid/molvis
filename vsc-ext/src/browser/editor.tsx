import { createRoot } from "react-dom/client";
import App from "../../../page/src/App";
// @ts-ignore css handled by bundler
import "../viewer/main.css";
import type { WebviewToHostMessage } from "../extension/types";

declare const acquireVsCodeApi:
  | undefined
  | (() => { postMessage: (message: WebviewToHostMessage) => void });

const vscode =
  typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined;

const viewerRoot = document.getElementById("root");
if (viewerRoot) {
  createRoot(viewerRoot).render(<App />);
  vscode?.postMessage({ type: "ready" });
}
