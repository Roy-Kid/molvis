import { Color3, Vector3 } from "@babylonjs/core";
import { mountMolvis } from "../src";
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

  const atomBlockWater = new AtomBlock(
    [0.0, 0.75695, -0.75695],
    [-0.06556, 0.52032, 0.52032],
    [0.0, 0.0, 0.0],
    ["O", "H", "H"],
  );
  atomBlockWater.set<string[]>('element', ["O", "H", "H"]);
  atomBlockWater.set<string[]>('name', ["O1", "H1", "H2"]);

  const bondBlockWater = new BondBlock([0, 0], [1, 2], [1, 1]);
  const frameWater = new Frame(atomBlockWater, bondBlockWater);

  // Ethanol molecule: CH3CH2OH
  const atomBlockEthanol = new AtomBlock(
    [0.0, 1.5, 2.5, 3.0, -0.5, -0.5, -0.5, 1.5, 1.5], // x
    [0.0, 0.0, 0.0, 0.8, 0.8, -0.4, -0.4, 0.8, -0.4], // y
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.7, -0.7, 0.0, 0.7], // z
    ["C", "C", "O", "H", "H", "H", "H", "H", "H"],
  );
  atomBlockEthanol.set<string[]>('element', ["C", "C", "O", "H", "H", "H", "H", "H", "H"]);
  atomBlockEthanol.set<string[]>('name', ["C1", "C2", "O1", "H_OH", "H_C1_1", "H_C1_2", "H_C1_3", "H_C2_1", "H_C2_2"]);

  const bondBlockEthanol = new BondBlock(
    [0, 1, 1, 2, 0, 0, 0, 1, 1], // i
    [1, 2, 3, 3, 4, 5, 6, 7, 8], // j
    [1, 1, 1, 1, 1, 1, 1, 1, 1]  // order
  );
  const frameEthanol = new Frame(atomBlockEthanol, bondBlockEthanol);

  try {
    // Draw water in default scene
    app.world.switchToScene('default');
    await app.world.executor.execute("draw_frame", {
      frame: frameWater,
      options: { bonds: { radius: 0.08 } },
    });
    const waterWorld = app.world;
    if (waterWorld) {
      waterWorld.camera.target = new Vector3(0, 0, 0);
    }

    // Create second scene with ethanol molecule
    app.world.createScene('ethanol-scene', app.canvas);
    app.world.switchToScene('ethanol-scene');
    app.gui.updateTabIndicator('ethanol-scene', app.world.allSceneIds);
    await app.world.executor.execute("draw_frame", {
      frame: frameEthanol,
      options: { bonds: { radius: 0.08 } },
    });
    const ethanolWorld = app.world;
    if (ethanolWorld) {
      ethanolWorld.camera.target = new Vector3(1.5, 0, 0);
    }

    app.start();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to initialize Molvis demo frames:", error);
  }
};

void initialize();
