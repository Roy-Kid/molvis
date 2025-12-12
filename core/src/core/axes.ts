import * as BABYLON from "@babylonjs/core";
import type { ArcRotateCamera } from "@babylonjs/core";

class AxisViewer {
  private _scene: BABYLON.Scene;
  private _axis: BABYLON.AxesViewer;

  constructor(
    scene: BABYLON.Scene,
    size: number,
  ) {
    this._scene = scene;
    this._axis = new BABYLON.AxesViewer(scene, size);
    const font_size = size * 0.3;
    const xChar = this._make_axis_label("X", "red", font_size);
    const yChar = this._make_axis_label("Y", "green", font_size);
    const zChar = this._make_axis_label("Z", "blue", font_size);
    xChar.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    yChar.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    zChar.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    // Position
    xChar.position.x += size * 0.8;
    yChar.position.y += size * 0.8;
    zChar.position.z += size * 0.8;

    // Flip
    zChar.rotation.y = Math.PI;

    // Parent
    xChar.parent = this._axis.xAxis;
    yChar.parent = this._axis.yAxis;
    zChar.parent = this._axis.zAxis;
  }

  private _make_axis_label(text: string, color: string, size: number) {
    const dynamicTexture = new BABYLON.DynamicTexture(
      "DynamicTexture",
      50,
      this._scene,
      true,
    );
    dynamicTexture.hasAlpha = true;
    dynamicTexture.drawText(
      text,
      5,
      40,
      "bold 36px Arial",
      color,
      "transparent",
      true,
    );
    const plane = BABYLON.MeshBuilder.CreatePlane(
      "TextPlane",
      { size: size },
      this._scene,
    );
    const material = new BABYLON.StandardMaterial(
      "TextPlaneMaterial",
      this._scene,
    );
    material.backFaceCulling = false;
    material.specularColor = new BABYLON.Color3(0, 0, 0);
    material.diffuseTexture = dynamicTexture;
    plane.material = material;
    return plane;
  }
}

class AxisHelper {
  private _scene: BABYLON.Scene;
  private _cameraGizmo: BABYLON.ArcRotateCamera;

  public constructor(engine: BABYLON.Engine, camera: ArcRotateCamera) {
    const scene = new BABYLON.Scene(engine);
    this._scene = scene;
    scene.useRightHandedSystem = true;
    scene.autoClear = false;
    this._cameraGizmo = new BABYLON.ArcRotateCamera(
      "cam1",
      2.0,
      Math.PI / 2,
      5,
      BABYLON.Vector3.Zero(),
      scene,
    );
    // Fix: Use positive viewport coordinates
    this._cameraGizmo.viewport = new BABYLON.Viewport(0.05, 0.05, 0.15, 0.15);

    new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, 1, 0),
      scene,
    );
    new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, -1, 0),
      scene,
    );

    new AxisViewer(scene, 0.5);

    // Clone active camera alpha and beta to axis camera
    scene.registerBeforeRender(() => {
      if (camera) {
        this._cameraGizmo.alpha = camera.alpha;
        this._cameraGizmo.beta = camera.beta;
      }
    });
  }

  public render() {
    this._scene.render();
  }
}

export { AxisHelper };
