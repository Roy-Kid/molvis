import { bootstrapWebview } from "./controller";

const container = document.getElementById("molvis-container");
if (!container) {
  throw new Error("Missing container");
}

bootstrapWebview(container);
