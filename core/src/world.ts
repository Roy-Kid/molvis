import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  Color3,
  Mesh,
} from "@babylonjs/core";
import { Artist } from "./artist";
import { AxisHelper } from "./axes";
import { Logger } from "tslog";

const logger = new Logger({ name: "molvis-core" });

class World {
  private _engine: Engine;
  private _scene: Scene;
  private _camera: ArcRotateCamera;
  private _artist: Artist;
  private _axes: AxisHelper;

  private _selected: Mesh[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this._engine = new Engine(canvas, true);
    this._scene = this.init_scene();
    this._camera = this.init_camera();
    this.init_light();
    // this._gui = this.init_gui();
    this._artist = this.init_artist();
    this._axes = this.init_axes();
  }

  public get scene(): Scene {
    return this._scene;
  }

  public get engine(): Engine {
    return this._engine;
  }

  public get camera(): ArcRotateCamera {
    return this._camera;
  }

  public get artist(): Artist {
    return this._artist;
  }

  public init_scene() {
    const scene = new Scene(this.engine);
    scene.useRightHandedSystem = true;
    return scene;
  }

  public init_camera() {
    const camera = new ArcRotateCamera(
      "Camera",
      -Math.PI / 2,
      Math.PI / 6,
      12,
      Vector3.Zero(),
      this.scene
    );
    camera.lowerRadiusLimit = 5;
    camera.attachControl(this.engine.getRenderingCanvas()!, false);
    camera.inertia = 0;

    return camera;
  }

  private init_light() {
    let hemisphericLight = new HemisphericLight(
      "ambientLight",
      new Vector3(0, 1, 0),
      this.scene
    );
    hemisphericLight.diffuse = new Color3(1, 1, 1);
    hemisphericLight.groundColor = new Color3(0, 0, 0);
    return hemisphericLight;
  }

  private init_artist() {
    const artist = new Artist(this.scene);
    return artist;
  }

  private init_axes() {
    return new AxisHelper(this.engine, this.camera);
  }

  public render() {
    // this._axes.resize();
    this.engine.runRenderLoop(() => {
      this.scene.render();
      this._axes.render();
    });
    this.engine.resize();
    window.addEventListener("resize", () => {
      this.engine.resize();
    });
  }

  public clear() {
    while (this._scene.meshes.length) {
      const mesh = this._scene.meshes[0];
      mesh.dispose();
    }
  }

  public select_mesh(mesh: Mesh) {
    this._selected.push(mesh);
  }

  public resize() {
    this.engine.resize();
  }
}

export { World };
