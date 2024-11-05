import {
  Scene,
  MeshBuilder,
  Mesh,
  StandardMaterial,
  Color3,
  Vector3,
  AbstractMesh,
  DynamicTexture,
  Engine
} from "@babylonjs/core";
import { AdvancedDynamicTexture } from "@babylonjs/gui";
import { Atom, Bond, Frame } from "./system";
import { real_atom_palette } from "./palette";

const get_name_from_mesh = (mesh: AbstractMesh) => {
  return mesh.name.split(":")[1];
}

class Artist {
  private _scene: Scene;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  public draw_atom(atom: Atom) {
    const color = real_atom_palette.get_color(atom);
    const radius = real_atom_palette.get_radius(atom);
    const sphere = MeshBuilder.CreateSphere(
      `atom:${atom.name}`,
      { diameter: radius },
      this._scene
    );
    const material = new StandardMaterial("atom", this._scene);
    material.diffuseColor = Color3.FromHexString(color);
    sphere.material = material;
    sphere.position = atom.position;
    return sphere;
  }

  public label_atom(labels: Record<string, string>) {

    // get all atom info
    const atom_meshs = this._scene.meshes.filter((mesh) =>
      mesh.name.startsWith("atom")
    );
    const ratio = 3.0;
    const resolution = 1000;
    const offset = 1.2;
    
    for (const atom_mesh of atom_meshs) {
      const atom_name = get_name_from_mesh(atom_mesh);
      const radius = atom_mesh.getBoundingInfo().boundingBox.extendSize.x;
      const plane_offset = new Vector3(0, radius*offset, 0);
      const height = 0.5;
      const label_plane = MeshBuilder.CreatePlane(`label_plane:${atom_mesh.name}`, {width: height * ratio, height: height}, this._scene);  // width and height are in scene units
      label_plane.rotate(new Vector3(0, 1, 0), Math.PI);
      const text = new DynamicTexture(`label_text:${atom_mesh.name}`, {width: height * resolution * ratio, height: height * resolution}, this._scene);  // width and height are in pixels
      text.drawText(labels[atom_name], 10, 200, "bold 256px monospace", "cyan", "#00000000", true);  // x and y are magical
      const material = new StandardMaterial("label", this._scene);
      material.diffuseTexture = text;
      material.diffuseTexture.hasAlpha = true;
      material.useAlphaFromDiffuseTexture = true;
      material.specularColor = new Color3(0, 0, 0);
      material.emissiveColor = new Color3(1, 1, 1);
      material.backFaceCulling = false;
      material.depthFunction = Engine.ALWAYS;
      label_plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
      label_plane.material = material;
      label_plane.position = atom_mesh.position.add(plane_offset);
    }

  }

  public draw_bond(bond: Bond, options?: { radius?: number; instance?: Mesh }) {
    let _options = {
      path: [bond.itom.position, bond.jtom.position],
      radius: 0.1,
    };
    // update _options with options with all keys
    _options = Object.assign(_options, options);

    const tube = MeshBuilder.CreateTube(
      `bond:${bond.itom.name}-${bond.jtom.name}`,
      _options,
      this._scene
    );
    return tube;
  }

  public draw_frame(frame: Frame) {
    for (let atom of frame.atoms) {
      this.draw_atom(atom);
    }

    for (let bond of frame.bonds) {
      this.draw_bond(bond);
    }
  }
}

export { Artist };
