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
import { Topology } from "./system/topology";
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

  // Viewport/Camera settings
  public viewportSettings: ViewportSettings;
  public targetIndicator: TargetIndicator;
  public axisHelper: AxisHelper;
  public grid: GridGround;

  // New unified selection system
  public sceneIndex: SceneIndex;
  public selectionManager: SelectionManager;
  public highlighter: Highlighter;
  public topology: Topology;

  constructor(canvas: HTMLCanvasElement, engine: Engine, app: MolvisApp) {
    this._engine = engine;
    this._app = app;

    // Initialize scene
    const scene = new Scene(engine);
    // Use Babylon.js default background color (blue-purple gradient)

    // Scene optimization
    scene.skipPointerMovePicking = true;
    scene.autoClear = true;
    scene.autoClearDepthAndStencil = true;

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

    // Set as active camera
    scene.activeCamera = camera;

    // Viewport Settings
    this.viewportSettings = new ViewportSettings(scene, camera);

    // Visual Overlays
    this.targetIndicator = new TargetIndicator(scene);
    this.axisHelper = new AxisHelper(this._engine, camera);
    this.grid = new GridGround(scene, camera, this._engine);
    if (this._app.config.grid?.enabled) {
      this.grid.enable();
    }

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
    this.highlighter = new Highlighter(scene);
    // Alias topology to the one managed by SceneIndex
    this.topology = this.sceneIndex.topology;

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

    // Apply initial graphics config
    this.applyGraphicsConfig();
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
    this._sceneData.camera.alpha = Math.PI / 4;
    this._sceneData.camera.beta = Math.PI / 3;
    this._sceneData.camera.radius = 10;
    this._sceneData.camera.setTarget(Vector3.Zero());
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
   * Apply graphics configuration from App.config.graphics
   */
  public applyGraphicsConfig() {
    const config = this._app.config.graphics;
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
    // Currently we don't use ShadowGenerator or Pipeline, so these flags 
    // (shadows, ssao, bloom, etc.) are implicitly respected (they are off).
    // Future implementations should check these flags.
  }
}
