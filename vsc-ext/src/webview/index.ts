import { mountMolvis, type MolvisConfig } from "@molvis/core";

const container = document.getElementById("molvis-container");
if (!container) throw new Error("Missing container");

const config: MolvisConfig = {
  fitContainer: true,
  showUI: true,
  grid: { enabled: true, mainColor: "#444", lineColor: "#666", opacity: 0.25, size: 10 }
};

const app = mountMolvis(container, config);  // Core API
app.start();                                  // Core API

const resizeObserver = new ResizeObserver(() => app.resize());  // Core API
resizeObserver.observe(container);

window.addEventListener("beforeunload", () => {
  resizeObserver.disconnect();
  app.destroy();  // Core API
});
