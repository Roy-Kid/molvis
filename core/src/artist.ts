import {
  type AbstractMesh,
  Color3,
  DynamicTexture,
  Engine,
  Mesh,
  MeshBuilder,
  type Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { Logger } from "tslog";
import { real_atom_palette } from "./palette";
import type { Atom, Bond, Frame } from "./system";

const logger = new Logger({ name: "molvis-core" });

const get_name_from_mesh = (mesh: AbstractMesh) => {
  return mesh.name.split(":")[1];
};

class Artist {
  private _scene: Scene;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  public draw_atom(atom: Atom) {
    const elem = atom.get("element");
    const color = real_atom_palette.get_color(elem as string);
    const radius = real_atom_palette.get_radius(elem as string);
    const sphere = MeshBuilder.CreateSphere(
      `atom:${atom.name}`,
      { diameter: radius },
      this._scene,
    );
    const material = new StandardMaterial("atom", this._scene);
    material.diffuseColor = Color3.FromHexString(color);
    sphere.material = material;
    sphere.position = atom.xyz;
    sphere.enablePointerMoveEvents = true;
    return sphere;
  }

  public label_atom(
    labels: Map<string, string>,
    offsetMultiplier = 1.2,
    fontSize = 256,
  ) {
    // 获取所有原子信息
    const atom_meshs = this._scene.meshes.filter((mesh) =>
      mesh.name.startsWith("atom"),
    );
    const ratio = 3.0;
    const resolution = 2000; // 高清纹理
    const offset = offsetMultiplier;

    for (const atom_mesh of atom_meshs) {
      const atom_name = get_name_from_mesh(atom_mesh);
      const radius = atom_mesh.getBoundingInfo().boundingBox.extendSize.x;
      const plane_offset = new Vector3(0, radius * offset, 0);
      const height = 0.5;
      const label_plane = MeshBuilder.CreatePlane(
        `label_plane:${atom_mesh.name}`,
        { width: height * ratio, height: height },
        this._scene,
      ); // 宽度和高度以场景单位为单位
      label_plane.rotate(new Vector3(0, 1, 0), Math.PI);
      const text = new DynamicTexture(
        `label_text:${atom_mesh.name}`,
        { width: height * resolution * ratio, height: height * resolution },
        this._scene,
      ); // 宽度和高度以像素为单位
      const label = labels.get(atom_name);
      if (label === undefined) {
        logger.warn(`No label found for atom ${atom_name}`);
        continue;
      }
      text.drawText(
        label,
        10,
        200,
        `bold ${fontSize}px monospace`,
        "cyan",
        "#00000000",
        true,
      ); // x 和 y 是魔法数
      const material = new StandardMaterial("label", this._scene);
      material.diffuseTexture = text;
      material.diffuseTexture.hasAlpha = true;
      material.useAlphaFromDiffuseTexture = true;
      material.specularColor = new Color3(0, 0, 0);
      material.emissiveColor = new Color3(1, 1, 1);
      material.backFaceCulling = false;
      material.alpha = 0.5; // 使平面透明
      material.depthFunction = Engine.ALWAYS;
      label_plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
      label_plane.material = material;
      label_plane.position = atom_mesh.position.add(plane_offset);
    }
  }

  public draw_bond(bond: Bond, options?: { radius?: number; instance?: Mesh }) {
    const path = [bond.itom.xyz, bond.jtom.xyz];
    const radius = options?.radius ?? 0.1;

    if (options?.instance) {
      const tube = MeshBuilder.CreateTube(
        `bond:${bond.name}`,
        { path, radius, instance: options.instance },
        this._scene,
      );
      return tube;
    } else {
      const tube = MeshBuilder.CreateTube(
        `bond:${bond.name}`,
        { path, radius, updatable: true },
        this._scene,
      );
      const material = new StandardMaterial("bond", this._scene);
      material.diffuseColor = new Color3(0.8, 0.8, 0.8);
      tube.material = material;
      return tube;
    }
  }

  public draw_frame(frame: Frame) {
    for (const atom of frame.atoms) {
      this.draw_atom(atom);
    }

    for (const bond of frame.bonds) {
      this.draw_bond(bond);
    }
  }
}

export { Artist };
