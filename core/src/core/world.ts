import {
  ArcRotateCamera,
  Color3,
  Engine,
  HemisphericLight,
  type LinesMesh,
  Scene,
  Vector3,
  Tools,
  Viewport,
} from "@babylonjs/core";
import { AxisHelper } from "./axes";
import { GridGround } from "./grid";
import { MeshGroup } from "./group";
import { Pipeline } from "../pipeline";
import type { Box } from "../structure/box";
import { ModeManager } from "../mode";
import { Executor } from "../command";
import { InstancedArtist, DynamicArtist } from "../artist";
import type { ArtistBase } from "../artist";
import { ViewManager } from "./view_manager";


interface SceneDataInternal {
  scene: Scene;
  viewManager: ViewManager;
  axes: AxisHelper;
  gridGround: GridGround;
  pipeline: Pipeline;
  boxMesh: LinesMesh | null;
  mode: ModeManager | null;
  executor: Executor;
  artists: Map<string, ArtistBase>;
  meshGroup: MeshGroup;
}


import { createLogger } from "../utils/logger";
const logger = createLogger("molvis-world");

class World {
  private _engine: Engine;
  private _scenes: Map<string, SceneDataInternal> = new Map();
  private _activeSceneId: string = "";
  private _context: any;
  private _isRunning = false;


  constructor(canvas: HTMLCanvasElement, engine: Engine, context: any) {
    this._engine = engine;
    this._context = context;
    this.createScene("default", canvas);
  }

  public createScene(sceneId: string, canvas: HTMLCanvasElement): void {
    if (this._scenes.has(sceneId)) {
      throw new Error(`Scene ${sceneId} already exists`);
    }

    const scene = this._initScene(this._engine);
    const viewManager = new ViewManager(scene, this._engine);
    this._initLight(scene);
    const pipeline = new Pipeline();
    const axes = this._initAxes(this._engine, viewManager); // Pass ViewManager
    const gridGround = new GridGround(scene, viewManager.activeCamera, this._engine);
    const meshGroup = new MeshGroup("root", scene);

    const executor = new Executor(this._context);

    const artists = new Map<string, ArtistBase>();
    const instancedArtist = new InstancedArtist(scene, "instanced");
    artists.set("instanced", instancedArtist);
    executor.registerArtist("instanced", instancedArtist);

    const dynamicArtist = new DynamicArtist(scene, "dynamic");
    artists.set("dynamic", dynamicArtist);
    executor.registerArtist("dynamic", dynamicArtist);

    void instancedArtist.init();
    void dynamicArtist.init();

    const sceneData: SceneDataInternal = {
      scene,
      viewManager,
      axes,
      gridGround,
      pipeline,
      boxMesh: null,
      mode: null,
      executor,
      artists,
      meshGroup,
    };

    this._scenes.set(sceneId, sceneData);

    if (this._scenes.size === 1) {
      this._activeSceneId = sceneId;
    }
  }

  public setMode(sceneId: string, mode: ModeManager): void {
    const sceneData = this._scenes.get(sceneId);
    if (sceneData) {
      sceneData.mode = mode;
    }
  }

  private _initScene = (engine: Engine) => {
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    return scene;
  };

  get scene(): Scene {
    return this._scenes.get(this._activeSceneId)!.scene;
  }

  get gridGround(): GridGround {
    return this._scenes.get(this._activeSceneId)!.gridGround;
  }

  get pipeline(): Pipeline {
    return this._scenes.get(this._activeSceneId)!.pipeline;
  }

  public get camera(): ArcRotateCamera {
    return this._scenes.get(this._activeSceneId)!.viewManager.activeCamera;
  }

  public get viewManager(): ViewManager {
    return this._scenes.get(this._activeSceneId)!.viewManager;
  }

  private _initLight(scene: Scene) {
    const hemisphericLight = new HemisphericLight(
      "ambientLight",
      new Vector3(0, 1, 0),
      scene,
    );
    hemisphericLight.diffuse = new Color3(1, 1, 1);
    hemisphericLight.groundColor = new Color3(0, 0, 0);
    return hemisphericLight;
  }

  private _initAxes(engine: Engine, viewManager: ViewManager) {
    return new AxisHelper(engine, viewManager);
  }

  public append_modifier(name: string, args: Record<string, unknown>) {
    this._scenes.get(this._activeSceneId)!.pipeline.append(name, args);
  }

  public takeScreenShot() {
    Tools.CreateScreenshot(this._engine, this.camera, { precision: 1.0 });
  }

  public setPerspective() {
    this.camera.mode = ArcRotateCamera.PERSPECTIVE_CAMERA;
  }

  public setOrthographic() {
    this.camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;
    const ratio =
      this._engine.getRenderWidth() / this._engine.getRenderHeight();
    const ortho = this.camera.radius;
    this.camera.orthoLeft = -ortho;
    this.camera.orthoRight = ortho;
    this.camera.orthoBottom = -ortho / ratio;
    this.camera.orthoTop = ortho / ratio;
  }

  public viewFront() {
    this.camera.alpha = -Math.PI / 2;
    this.camera.beta = Math.PI / 2;
  }

  public viewBack() {
    this.camera.alpha = Math.PI / 2;
    this.camera.beta = Math.PI / 2;
  }

  public viewLeft() {
    this.camera.alpha = Math.PI;
    this.camera.beta = Math.PI / 2;
  }

  public viewRight() {
    this.camera.alpha = 0;
    this.camera.beta = Math.PI / 2;
  }

  public setViewport(x: number, y: number, width: number, height: number): void {
    this.camera.viewport = new Viewport(x, y, width, height);
  }

  public render(): void {
    if (this._isRunning) {
      return;
    }

    this._isRunning = true;

    this._engine.runRenderLoop(() => {
      const active = this._scenes.get(this._activeSceneId)!;
      active.scene.render();
      active.axes.render();
    });
    this._engine.resize();
    window.addEventListener("resize", () => {
      this._engine.resize();
      this.viewManager.resize();
    });
  }

  public renderOnce(): void {
    const active = this._scenes.get(this._activeSceneId)!;
    active.scene.render();
    active.axes.render();
  }

  public stop(): void {
    this._isRunning = false;
  }

  public clear() {
    const active = this._scenes.get(this._activeSceneId)!;
    while (active.scene.meshes.length) {
      const mesh = active.scene.meshes[0];
      mesh.dispose();
    }
    if (active.boxMesh) {
      active.boxMesh.dispose();
      active.boxMesh = null;
    }
    // Re-enable grid ground after clearing
    if (active.gridGround.isEnabled) {
      active.gridGround.disable();
      active.gridGround.enable();
    }
  }

  public resize() {
    this._engine.resize();
    this.viewManager.resize();
  }

  public isOrthographic(): boolean {
    return this.camera.mode === ArcRotateCamera.ORTHOGRAPHIC_CAMERA;
  }

  public switchToScene(sceneId: string): void {
    if (!this._scenes.has(sceneId)) {
      throw new Error(`Scene ${sceneId} does not exist`);
    }
    this._activeSceneId = sceneId;
  }

  public get activeSceneId(): string {
    return this._activeSceneId;
  }

  public getScene(sceneId: string): SceneDataInternal | undefined {
    return this._scenes.get(sceneId);
  }

  public get allSceneIds(): string[] {
    return Array.from(this._scenes.keys());
  }

  public destroyScene(sceneId: string): void {
    const sceneData = this._scenes.get(sceneId);
    if (sceneData) {
      // TODO: proper cleanup
      this._scenes.delete(sceneId);
      if (this._activeSceneId === sceneId) {
        const remaining = this.allSceneIds;
        this._activeSceneId = remaining.length > 0 ? remaining[0] : "";
      }
    }
  }

  public renderAll(): void {
    if (!this._engine) return;
    this._engine.runRenderLoop(() => {
      for (const sceneData of this._scenes.values()) {
        // sceneData.camera.viewport = sceneData.viewport; // ViewManager handles this now
        sceneData.scene.render();
        sceneData.axes.render();
      }
    });
    this._engine.resize();
    window.addEventListener("resize", () => {
      if (this._engine) this._engine.resize();
    });
  }

  public stopAll(): void {
    if (this._engine) {
      this._engine.stopRenderLoop();
    }
  }

  public get mode(): ModeManager | null {
    return this._scenes.get(this._activeSceneId)?.mode || null;
  }

  public get executor(): Executor {
    return this._scenes.get(this._activeSceneId)!.executor;
  }

  public get artists(): Map<string, ArtistBase> {
    return this._scenes.get(this._activeSceneId)?.artists || new Map();
  }

  public get meshGroup(): MeshGroup {
    return this._scenes.get(this._activeSceneId)!.meshGroup;
  }
}

export { World };
