import { Scene, Engine, HemisphericLight, DirectionalLight, Vector3, Color3, ArcRotateCamera, FxaaPostProcess, Tools } from "@babylonjs/core";
import { Inspector } from '@babylonjs/inspector';
import { type MolvisApp } from "./app";
import { ViewportSettings } from "./viewport_settings";
import { TargetIndicator } from "./target_indicator";
import { ModeManager } from "../mode";
import { AxisHelper } from "./axis_helper";
import { SceneIndex } from "./scene_index";
import { GridGround } from "./grid";
import { SelectionManager } from "./selection_manager";
import { Highlighter } from "./highlighter";
import { Picker } from "./picker";
import { logger } from "../utils/logger";

export class World {
  private _engine: Engine;
  private _app: MolvisApp;
  private _sceneData: {
    scene: Scene;
    camera: ArcRotateCamera;
    light: HemisphericLight;
  };
  private _fxaa?: FxaaPostProcess;
  private _modeManager?: ModeManager;
  private _lastRadius: number = 10;

  // Viewport/Camera settings
  public viewportSettings: ViewportSettings;
  public targetIndicator: TargetIndicator;
  public axisHelper: AxisHelper;
  public grid: GridGround;

  // New unified selection system
  public sceneIndex: SceneIndex;
  public selectionManager: SelectionManager;
  public highlighter: Highlighter;
  public picker: Picker;

  constructor(canvas: HTMLCanvasElement, engine: Engine, app: MolvisApp) {
    this._engine = engine;
    this._app = app;

    // Initialize scene
    const scene = new Scene(engine);
    // Use Babylon.js default background color (blue-purple gradient)

    // Scene optimization
    scene.skipPointerMovePicking = false;
    scene.autoClear = true;
    scene.autoClearDepthAndStencil = true;

    // Apply Coordinate System Config
    if (this._app.config.useRightHandedSystem) {
      scene.useRightHandedSystem = true;
    }

    // Create ArcRotateCamera directly
    const camera = new ArcRotateCamera(
      "camera",
      Math.PI / 4,  // alpha
      Math.PI / 3,  // beta
      10,           // radius
      Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);

    // Initialize last radius for ortho zoom tracking
    this._lastRadius = camera.radius;

    // Handle Orthographic Zoom
    // ArcRotateCamera changes radius on zoom, but in Ortho mode this doesn't change view size if bounds are fixed.
    // We bind radius changes to ortho bounds scaling.
    scene.onBeforeRenderObservable.add(() => {
      if (camera.mode === 1) { // Orthographic
        if (this._lastRadius > 0 && Math.abs(camera.radius - this._lastRadius) > 0.0001) {
          const scale = camera.radius / this._lastRadius;
          // Scale ortho bounds
          if (camera.orthoTop && camera.orthoBottom && camera.orthoLeft && camera.orthoRight) {
            camera.orthoTop *= scale;
            camera.orthoBottom *= scale;
            camera.orthoLeft *= scale;
            camera.orthoRight *= scale;
          }
        }
      }
      this._lastRadius = camera.radius;
    });

    // Set as active camera
    scene.activeCamera = camera;

    // Viewport Settings
    this.viewportSettings = new ViewportSettings(scene, camera);

    // Visual Overlays
    this.targetIndicator = new TargetIndicator(scene);
    this.axisHelper = new AxisHelper(this._engine, camera);
    this.grid = new GridGround(scene, camera, this._engine);

    // Initial grid settings are applied by Settings when initialized in App

    // Lighting setup for depth with minimal shadows
    // 1. Hemispheric light for soft global illumination (fill)
    // High intensity and bright ground color ensures atoms look fully lit even in crevices
    const hemiLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), scene);
    hemiLight.intensity = 0.7;
    hemiLight.groundColor = new Color3(0.6, 0.6, 0.6); // Strong bounce light to remove dark under-sides
    hemiLight.specular = Color3.Black(); // Reduce specular on hemi to avoid washout

    // 2. Directional light for definition (key light)
    // Attached to camera to ensure viewed side is always lit ("Headlamp")
    const dirLight = new DirectionalLight("dirLight", new Vector3(0, 0, 1), scene);
    dirLight.parent = camera;
    dirLight.intensity = 0.4; // Slightly reduced to balance with stronger ambient
    dirLight.specular = new Color3(0.5, 0.5, 0.5); // Add some shine for "stereoscopic" feel

    // Initialize new unified selection system
    this.sceneIndex = new SceneIndex();
    this.selectionManager = new SelectionManager(this.sceneIndex);
    this.highlighter = new Highlighter(app, scene);
    this.picker = new Picker(app, scene);
    // Wire up event: selection changes trigger highlighting
    this.selectionManager.on(state => this.highlighter.highlightSelection(state));

    this._sceneData = {
      scene,
      light: hemiLight,
      camera
    };

    // Resize handling
    window.addEventListener("resize", () => {
      engine.resize();
    });

    // Initial graphics settings will be applied by Settings when it is initialized
  }

  public get scene(): Scene {
    return this._sceneData.scene;
  }

  public get camera(): ArcRotateCamera {
    return this._sceneData.camera;
  }

  public get mode() {
    return this._modeManager?.currentMode;
  }

  public setMode(modeManager: ModeManager) {
    this._modeManager = modeManager;
  }

  // Camera control methods
  public focusOn(target: Vector3) {
    this._sceneData.camera.setTarget(target);
  }

  public resetCamera() {
    const bounds = this.sceneIndex.getBounds();

    if (bounds) {
      const center = new Vector3(
        (bounds.min.x + bounds.max.x) * 0.5,
        (bounds.min.y + bounds.max.y) * 0.5,
        (bounds.min.z + bounds.max.z) * 0.5
      );

      const size = new Vector3(
        bounds.max.x - bounds.min.x,
        bounds.max.y - bounds.min.y,
        bounds.max.z - bounds.min.z
      );

      const maxDim = Math.max(size.x, size.y, size.z);

      // Calculate required radius to fit the scene
      // FOV (alpha) is vertical.
      const fov = this._sceneData.camera.fov;
      const aspectRatio = this._engine.getAspectRatio(this._sceneData.camera);

      // Distance needed to fit height
      let distance = maxDim / (2 * Math.tan(fov / 2));

      // If width is narrower, adjust for aspect ratio
      if (aspectRatio < 1.0) {
        distance = distance / aspectRatio;
      }

      // Add some padding (margin)
      distance *= 1.2;

      // Ensure minimum distance
      distance = Math.max(distance, 5.0);

      this._sceneData.camera.setTarget(center);
      this._sceneData.camera.radius = distance;

      // Reset angles to a nice isometric-ish view
      this._sceneData.camera.alpha = Math.PI / 4;
      this._sceneData.camera.beta = Math.PI / 3;
    } else {
      // Fallback if no data
      this._sceneData.camera.setTarget(Vector3.Zero());
      this._sceneData.camera.radius = 10;
      this._sceneData.camera.alpha = Math.PI / 4;
      this._sceneData.camera.beta = Math.PI / 3;
    }
  }

  public takeScreenShot() {
    logger.info('[World] Taking screenshot...');
    Tools.CreateScreenshotUsingRenderTarget(
      this._engine,
      this._sceneData.camera,
      { precision: 1 },
      (data) => {
        const link = document.createElement('a');
        link.download = `molvis-screenshot-${Date.now()}.png`;
        link.href = data;
        link.click();
        logger.info('[World] Screenshot downloaded');
      }
    );
  }

  /**
   * Start the render loop
   */
  public start() {
    this._engine.runRenderLoop(() => {
      this._sceneData.scene.render();
      // Render axis helper in viewport corner
      this.axisHelper.render();
      const fps = this._engine.getFps();
      this._app.events.emit('fps-change', fps);
    });
  }

  /**
   * Stop the render loop
   */
  public stop() {
    this._engine.stopRenderLoop();
  }

  public toggleInspector() {
    const scene = this._sceneData.scene;
    if (scene.debugLayer.isVisible()) {
      scene.debugLayer.hide();
      return;
    }
    Inspector.Show(scene, {
      embedMode: true,
    });
  }

  /**
   * Resize the engine
   */
  public resize() {
    this._engine.resize();
  }

  /**
   * Apply graphics settings
   */
  public applyGraphicsSettings(config: {
    shadows?: boolean;
    postProcessing?: boolean;
    ssao?: boolean;
    bloom?: boolean;
    ssr?: boolean;
    dof?: boolean;
    fxaa?: boolean;
    hardwareScaling?: number;
  }) {
    if (!config) return;

    // 1. Hardware Scaling (Resolution)
    // config.hardwareScaling: 1.0 = native, 0.5 = half res
    // engine.setHardwareScalingLevel: 1.0 = native, 2.0 = half res (it's inverse)
    if (config.hardwareScaling) {
      this._engine.setHardwareScalingLevel(1.0 / config.hardwareScaling);
    }

    // 2. FXAA
    if (config.fxaa) {
      if (!this._fxaa) {
        this._fxaa = new FxaaPostProcess("fxaa", 1.0, this._sceneData.camera);
      }
    } else {
      if (this._fxaa) {
        this._fxaa.dispose();
        this._fxaa = undefined;
      }
    }

    // 3. Shadows & Post-Processing
    // Currently we don't use ShadowGenerator or Pipeline
  }
}
