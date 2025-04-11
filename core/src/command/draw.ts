import { MeshBuilder, StandardMaterial, Color3 } from "@babylonjs/core";
import type { Mesh } from "@babylonjs/core";
import { registerCommand } from "./base";
import type { ICommand } from "./base";
import type { Molvis } from "@molvis/core";
import { realAtomPalette } from "../artist";
import type { IEntity } from "@molvis/core";
import { Frame } from "../system/frame";
import { Atom, Bond } from "../system/item";
import type { IProp } from "../system";

interface IDrawAtomOptions {
  radius?: number;
}
interface IDrawBondOptions {
  radius: number;
  update: boolean;
}
interface IDrawFrameOptions {
  atoms: IDrawAtomOptions;
  bonds: IDrawBondOptions;
  // an option to specify if clean the scene
  clean: boolean;
}

const draw_atom = (app: Molvis, atom: Atom, options: IDrawAtomOptions) => {
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

const draw_frame = (app: Molvis, frame: Frame, options: IDrawFrameOptions) => {
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
  const spheres = frame.atoms.map((atom) =>
    draw_atom(app, atom, options.atoms),
  );
  const tubes = frame.bonds.map((bond) => draw_bond(app, bond, options.bonds));
  return [...spheres, ...tubes];
};

const draw_bond = (app: Molvis, bond: Bond, options: IDrawBondOptions) => {
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

@registerCommand("draw_atom")
class DrawAtom implements ICommand {
  public x: number;
  public y: number;
  public z: number;
  public name: string;
  public props?: Record<string, IProp>;
  public options: IDrawAtomOptions;

  constructor(
    name: string,
    x: number,
    y: number,
    z: number,
    props: Record<string, IProp> = {},
    options: IDrawAtomOptions = {},
  ) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.name = name;
    this.props = props;
    this.options = options;
  }

  public do(app: Molvis) {
    const atom = app.system.current_frame.add_atom(
      this.name,
      this.x,
      this.y,
      this.z,
      this.props,
    );

    const sphere = draw_atom(app, atom, this.options);
    return [[sphere], [atom]] as [Mesh[], IEntity[]];
  }

  public undo(app: Molvis) {
    // const atom = app.system.current_frame.get_atom(this.name);
    // if (atom) {
    //     app.artist.do("remove_atom", atom);
    //     app.system.current_frame.remove_atom(atom);
    // }
    // return atom;
  }
}

@registerCommand("draw_frame")
class DrawFrame {
  private _frame: Frame;
  private _options;
  constructor(args: {
    atoms: {
      name: string[];
      x: number[];
      y: number[];
      z: number[];
      props: Record<string, IProp[]>;
    };
    bonds: { bond_i: number[]; bond_j: number[] };
    options: IDrawFrameOptions;
  }) {
    const atom_data = args.atoms;
    const bond_data = args.bonds;
    this._options = args.options;
    const x = atom_data.x;
    const y = atom_data.y;
    const z = atom_data.z;

    const atoms = atom_data.name.map((n, i) => {
      // get a prop from props for all key
      const atomProps = Object.keys(atom_data.props).reduce(
        (acc: Record<string, IProp>, key) => {
          acc[key] = atom_data.props[key][i];
          return acc;
        },
        {} as Record<string, IProp>,
      );
      return new Atom(n, x[i], y[i], z[i], atomProps);
    });

    let bonds: Bond[] = [];
    if (bond_data.bond_i && bond_data.bond_j) {
      if (bond_data.bond_i.length !== bond_data.bond_j.length) {
        throw new Error("bond_i and bond_j must have the same length");
      }
      bonds = bond_data.bond_i.map((_, i) => {
        const itom = atoms[bond_data.bond_i[i]];
        const jtom = atoms[bond_data.bond_j[i]];
        return new Bond(itom, jtom);
      });
    }

    this._frame = new Frame(atoms, bonds);
  }

  public do(app: Molvis) {
    app.system.append_frame(this._frame);
    const meshs = draw_frame(app, this._frame, this._options);
    return [meshs, [...this._frame.atoms, ...this._frame.bonds]] as [
      Mesh[],
      IEntity[],
    ];
  }

  public undo(app: Molvis) {}
}

export { DrawAtom, DrawFrame };
