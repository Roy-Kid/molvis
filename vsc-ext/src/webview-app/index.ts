import { bootstrapWebview } from "./runtime/controller";

const container = document.getElementById("molvis-container");
if (!container) {
  throw new Error("Missing container");
}

bootstrapWebview(container);
