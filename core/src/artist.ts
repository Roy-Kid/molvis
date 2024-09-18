import { Scene, MeshBuilder, Mesh, StandardMaterial, Color3 } from "@babylonjs/core";
import { Atom, Bond, Frame } from "./system";
import { real_atom_palette } from "./palette";

class Artist {
  private _scene: Scene;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  public draw_atom(atom: Atom) {

    const color = real_atom_palette.get_color(atom);
    const radius = real_atom_palette.get_radius(atom);

    const sphere = MeshBuilder.CreateSphere(
      `atom:${atom.id}`,
      { diameter: radius },
      this._scene
    );
    const material = new StandardMaterial('atom', this._scene);
    material.diffuseColor = Color3.FromHexString(color);
    sphere.material = material;
    sphere.position = atom.position;
    return sphere;
  }

  public draw_bond(bond: Bond, options?: { radius?: number; instance?: Mesh }) {
    let _options = {
      path: [bond.itom.position, bond.jtom.position],
      radius: 0.1,
    };
    // update _options with options with all keys
    _options = Object.assign(_options, options);

    const tube = MeshBuilder.CreateTube(
      `bond:${bond.itom.id}-${bond.jtom.id}`,
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
