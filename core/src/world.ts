import {
  ArcRotateCamera,
  Color3,
  type Engine,
  HemisphericLight,
  type Mesh,
  type Scene,
  Vector3,
} from "@babylonjs/core";
import { Logger } from "tslog";
import { Artist } from "./artist";
import { AxisHelper } from "./axes";

const logger = new Logger({ name: "molvis-core" });

interface GuiOptions {
  useFrameIndicator: boolean;
}

class World {
  private _engine: Engine;
  private _scene: Scene;
  private _camera: ArcRotateCamera;
  private _artist: Artist;
  private _axes: AxisHelper;
  private _selected: Mesh[] = [];

  constructor(engine: Engine, scene: Scene) {
    this._engine = engine;
    this._scene = scene;
    this._camera = this.init_camera();
    this.init_light();
    this._artist = this.init_artist();
    this._axes = this.init_axes();
  }

  get scene(): Scene {
    return this._scene;
  }

  public get camera(): ArcRotateCamera {
    return this._camera;
  }

  public get artist(): Artist {
    return this._artist;
  }

  public init_camera() {
    const camera = new ArcRotateCamera(
      "Camera",
      -Math.PI / 2,
      Math.PI / 6,
      12,
      Vector3.Zero(),
      this._scene,
    );
    camera.lowerRadiusLimit = 5;
    camera.attachControl(this._engine.getRenderingCanvas(), false);
    camera.inertia = 0;

    return camera;
  }

  private init_light() {
    const hemisphericLight = new HemisphericLight(
      "ambientLight",
      new Vector3(0, 1, 0),
      this._scene,
    );
    hemisphericLight.diffuse = new Color3(1, 1, 1);
    hemisphericLight.groundColor = new Color3(0, 0, 0);
    return hemisphericLight;
  }

  private init_artist() {
    const artist = new Artist(this._scene);
    return artist;
  }

  private init_axes() {
    return new AxisHelper(this._engine, this.camera);
  }

  public render() {
    // this._axes.resize();
    this._engine.runRenderLoop(() => {
      this._scene.render();
      this._axes.render();
    });
    this._engine.resize();
    window.addEventListener("resize", () => {
      this._engine.resize();
    });
  }

  public stop() {
    this._engine.dispose();
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
    this._engine.resize();
  }
}

export { World };
