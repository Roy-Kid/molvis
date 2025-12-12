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
import { Executor } from "../commands";
import { ModeManager } from "../mode";
import { MolecularTopology } from "./topology";


interface SceneDataInternal {
  scene: Scene;
  camera: ArcRotateCamera;
  axes: AxisHelper;
  gridGround: GridGround;
  boxMesh: LinesMesh | null;
  mode: ModeManager | null;
  executor: Executor;
  meshGroup: MeshGroup;
}



class World {
  private _engine: Engine;
  private _sceneData: SceneDataInternal;
  private _context: any;
  private _isRunning = false;
  private _topology: MolecularTopology = new MolecularTopology();


  constructor(canvas: HTMLCanvasElement, engine: Engine, context: any) {
    this._engine = engine;
    this._context = context;

    const scene = this._initScene(this._engine);
    const camera = this._initCamera(scene, canvas);
    this._initLight(scene);
    const axes = this._initAxes(this._engine, camera);
    const gridGround = new GridGround(scene, camera, this._engine);
    const meshGroup = new MeshGroup("root", scene);

    const executor = new Executor(this._context);

    this._sceneData = {
      scene,
      camera,
      axes,
      gridGround,
      boxMesh: null,
      mode: null,
      executor,
      meshGroup,
    };
  }

  public setMode(mode: ModeManager): void {
    this._sceneData.mode = mode;
  }

  private _initScene = (engine: Engine) => {
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    return scene;
  };

  get scene(): Scene {
    return this._sceneData.scene;
  }

  get gridGround(): GridGround {
    return this._sceneData.gridGround;
  }

  public get camera(): ArcRotateCamera {
    return this._sceneData.camera;
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

  private _initCamera(scene: Scene, canvas: HTMLCanvasElement): ArcRotateCamera {
    const camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 3,
      10,
      Vector3.Zero(),
      scene
    );
    camera.inertia = 0;
    camera.attachControl(canvas, true);
    scene.activeCamera = camera;
    return camera;
  }

  private _initAxes(engine: Engine, camera: ArcRotateCamera) {
    return new AxisHelper(engine, camera);
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
      this._sceneData.scene.render();
      this._sceneData.axes.render();
    });
    this._engine.resize();
    window.addEventListener("resize", () => {
      this._engine.resize();
    });
  }

  public renderOnce(): void {
    this._sceneData.scene.render();
    this._sceneData.axes.render();
  }

  public stop(): void {
    this._isRunning = false;
  }

  public clear() {
    // Clear topology
    this._topology.clear();
    
    while (this._sceneData.scene.meshes.length) {
      const mesh = this._sceneData.scene.meshes[0];
      mesh.dispose();
    }
    if (this._sceneData.boxMesh) {
      this._sceneData.boxMesh.dispose();
      this._sceneData.boxMesh = null;
    }
    // Re-enable grid ground after clearing
    if (this._sceneData.gridGround.isEnabled) {
      this._sceneData.gridGround.disable();
      this._sceneData.gridGround.enable();
    }
  }

  public resize() {
    this._engine.resize();
  }

  public isOrthographic(): boolean {
    return this.camera.mode === ArcRotateCamera.ORTHOGRAPHIC_CAMERA;
  }

  public get mode(): ModeManager | null {
    return this._sceneData.mode;
  }

  public get executor(): Executor {
    return this._sceneData.executor;
  }

  public get meshGroup(): MeshGroup {
    return this._sceneData.meshGroup;
  }

  /**
   * Get the molecular topology graph.
   */
  public get topology(): MolecularTopology {
    return this._topology;
  }

}

export { World };
