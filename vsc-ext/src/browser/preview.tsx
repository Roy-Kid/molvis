import { bootstrapWebview } from "../webview/controller";

const webviewContainer = document.getElementById("molvis-container");
if (webviewContainer) {
  bootstrapWebview(webviewContainer);
}
