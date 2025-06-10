import { realAtomPalette } from "./palette";
import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  type Mesh,
} from "@babylonjs/core";
import type { Molvis, Atom, Bond, Frame } from "@molvis/core";
export interface IDrawAtomOptions {
  radius?: number;
}
export interface IDrawBondOptions {
  radius?: number;
  update?: boolean;
}
export interface IDrawFrameOptions {
  atoms: IDrawAtomOptions;
  bonds: IDrawBondOptions;
  clean: boolean;
}

export const draw_atom = (
  app: Molvis,
  atom: Atom,
  options: IDrawAtomOptions,
) => {
  const atype = atom.get("type") ?? atom.get("element");
  const name = (atom.get("name") as string) ?? "";
  let identifier = atype;
  if (identifier === undefined) {
    identifier = name;
  }
  const radius =
    options.radius ?? realAtomPalette.getAtomRadius(identifier as string);
  const color = realAtomPalette.getAtomColor(identifier as string);
  const sphere = MeshBuilder.CreateSphere(
    `atom:${atom.name}`,
    { diameter: radius },
    app.scene,
  );
  const material = new StandardMaterial("atom", app.scene);
  material.diffuseColor = Color3.FromHexString(color);
  sphere.material = material;
  sphere.position = atom.xyz;
  sphere.enablePointerMoveEvents = true;
  return sphere;
};

export const draw_frame = (
  app: Molvis,
  frame: Frame,
  options: IDrawFrameOptions,
) => {
  console.log("start to draw", frame);
  console.log("options", options);
  if (options !== undefined) {
    if (options.clean ?? true) {
      const meshesToDispose = [];
      for (const mesh of app.scene.meshes) {
        if (mesh.name.startsWith("atom:") || mesh.name.startsWith("bond:")) {
          meshesToDispose.push(mesh);
        }
      }
      for (const mesh of meshesToDispose) {
        mesh.dispose();
      }
    }
  }
  console.log("draw_atoms", frame.atoms);
  const spheres = frame.atoms.map((atom) =>
    draw_atom(app, atom, options.atoms),
  );
  console.log("draw_bonds", frame.bonds);
  const tubes = frame.bonds.map((bond) => draw_bond(app, bond, options.bonds));
  return [...spheres, ...tubes];
};

export const draw_bond = (
  app: Molvis,
  bond: Bond,
  options: IDrawBondOptions,
) => {
  console.log("draw_bond", bond);
  const path = [bond.itom.xyz, bond.jtom.xyz];
  const radius = options.radius ?? 0.1;

  if (options.update) {
    // find instance
    const instance = app.scene.getMeshByName(`bond:${bond.name}`);
    if (instance) {
      const tube = MeshBuilder.CreateTube(`bond:${bond.name}`, {
        path,
        radius,
        instance: instance as Mesh,
      });
      return tube;
    }
  }
  const tube = MeshBuilder.CreateTube(
    `bond:${bond.name}`,
    { path, radius, updatable: true },
    app.scene,
  );
  const material = new StandardMaterial("bond", app.scene);
  material.diffuseColor = new Color3(0.8, 0.8, 0.8);
  tube.material = material;
  return tube;
};
