import { Vector3 } from "@babylonjs/core";
import { mountMolvis } from "../src/app";
import { AtomBlock, BondBlock, Frame } from "../src/structure";

const ensureGlobalStyles = (): void => {
  if (document.getElementById("molvis-test-styles")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "molvis-test-styles";
  style.textContent =
    "html,body{width:100%;height:100%;margin:0;padding:0;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}";
  document.head.appendChild(style);
};

const initialize = async (): Promise<void> => {
  ensureGlobalStyles();

  const mountPoint = document.createElement("div");
  mountPoint.id = "app-container";
  mountPoint.style.cssText = "width:100vw;height:100vh;margin:0;padding:0;";
  document.body.appendChild(mountPoint);

  const app = mountMolvis(mountPoint, {
    fitContainer: true,
    showUI: true,
    autoRenderResolution: true,
  });

  const atomBlock = new AtomBlock(
    [0.0, 0.75695, -0.75695],
    [-0.06556, 0.52032, 0.52032],
    [0.0, 0.0, 0.0],
    ["O", "H", "H"],
  );
  atomBlock.set<string[]>('element', ["O", "H", "H"]);

  const bondBlock = new BondBlock([0, 0], [1, 2], [1, 1]);
  const frame = new Frame(atomBlock, bondBlock);

  try {
    await app.executor.execute("draw_frame", {
      frame,
      options: { bonds: { radius: 0.08 } },
    });

    app.world.camera.target = new Vector3(0, 0, 0);
    app.start();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to initialize Molvis demo frame:", error);
  }
};

void initialize();
