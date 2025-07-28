import { Molvis } from "../src/app";
import { Vector3 } from "@babylonjs/core";

document.documentElement.lang = "en";

// Create a simple mount point
const mountPoint = document.createElement("div");
mountPoint.id = "app-container";
mountPoint.style.cssText = `
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
`;
document.body.appendChild(mountPoint);

// Add basic styles
const style = document.createElement("style");
style.textContent = `
html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
`;
document.head.appendChild(style);

// Initialize Molvis with fullscreen options
const app = new Molvis(mountPoint, {
  fitContainer: true,
  showUI: true,
  autoRenderResolution: true,
});

// Frame 1: Water molecule (H2O)
app.execute("draw_frame", {
  frameData: {
    blocks: {
      atoms: {
        name: ["O", "H1", "H2"],
        xyz: [
          [0.0, -0.06556, 0.0],
          [0.75695, 0.52032, 0.0],
          [-0.75695, 0.52032, 0.0]
        ],
        element: ["O", "H", "H"],
      },
      bonds: {
        i: [0, 0],
        j: [1, 2],
      },
    },
  },
  options: {
    atoms: {},
    bonds: {
      radius: 0.05,
    },
  },
});

// Frame 2: Methane molecule (CH4)
app.execute("draw_frame", {
  frameData: {
    blocks: {
      atoms: {
        name: ["C", "H1", "H2", "H3", "H4"],
        xyz: [
          [2.0, 0.0, 0.0],
          [2.8, 0.8, 0.8],
          [1.2, 0.8, -0.8],
          [2.8, -0.8, 0.8],
          [1.2, -0.8, -0.8]
        ],
        element: ["C", "H", "H", "H", "H"],
      },
      bonds: {
        i: [0, 0, 0, 0],
        j: [1, 2, 3, 4],
      },
    },
  },
  options: {
    atoms: {},
    bonds: {
      radius: 0.05,
    },
  },
});

// Frame 3: Ammonia molecule (NH3)
app.execute("draw_frame", {
  frameData: {
    blocks: {
      atoms: {
        name: ["N", "H1", "H2", "H3"],
        xyz: [
          [-2.0, 0.0, 0.0],
          [-1.2, 0.8, 0.0],
          [-2.8, 0.0, 0.8],
          [-2.0, -0.8, 0.8]
        ],
        element: ["N", "H", "H", "H"],
      },
      bonds: {
        i: [0, 0, 0],
        j: [1, 2, 3],
      },
    },
  },
  options: {
    atoms: {},
    bonds: {
      radius: 0.05,
    },
  },
});

// Set camera target to center
app.world.camera.target = new Vector3(0, 0, 0);

// Start rendering
app.start();