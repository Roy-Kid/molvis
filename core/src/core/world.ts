import { Scene, Engine, HemisphericLight, Vector3, ArcRotateCamera } from "@babylonjs/core";
import { type MolvisApp } from "./app";
import { ViewportSettings } from "./viewport_settings";
import { TargetIndicator } from "./target_indicator";
import { ModeManager } from "../mode";
import { AxisHelper } from "./axis_helper";
import { SceneIndex } from "./scene_index";
import { GridGround } from "./grid";
import { SelectionManager } from "./selection_manager";
import { Highlighter } from "./highlighter";

export class World {
  private _engine: Engine;
  private _app: MolvisApp;
  private _sceneData: {
    scene: Scene;
    camera: ArcRotateCamera;
    light: HemisphericLight;
  };
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
    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 100;
    camera.wheelPrecision = 50;
    camera.panningSensibility = 1000;

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

    // Basic lighting
    const light = new HemisphericLight("light", new Vector3(0.5, 1, 0), scene);
    light.intensity = 0.8;

    // Initialize new unified selection system
    this.sceneIndex = new SceneIndex();
    this.selectionManager = new SelectionManager(this.sceneIndex);
    this.highlighter = new Highlighter(scene);

    // Wire up event: selection changes trigger highlighting
    this.selectionManager.on(state => this.highlighter.highlightSelection(state));

    this._sceneData = {
      scene,
      light,
      camera
    };

    // Resize handling
    window.addEventListener("resize", () => {
      engine.resize();
    });
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
    console.log('[World] Taking screenshot...');
    import('@babylonjs/core').then(({ Tools }) => {
      Tools.CreateScreenshotUsingRenderTarget(
        this._engine,
        this._sceneData.camera,
        { precision: 1 },
        (data) => {
          const link = document.createElement('a');
          link.download = `molvis-screenshot-${Date.now()}.png`;
          link.href = data;
          link.click();
          console.log('[World] Screenshot downloaded');
        }
      );
    });
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

  /**
   * Resize the engine
   */
  public resize() {
    this._engine.resize();
  }
}
