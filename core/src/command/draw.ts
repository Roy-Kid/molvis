import type { Mesh } from "@babylonjs/core";
import { registerCommand, type ICommand } from "./base";
import { Frame } from "../system/frame";
import type { Bond, IProp } from "../system";
import {
  draw_atom,
  draw_frame,
  draw_bond,
  type IDrawAtomOptions,
  type IDrawFrameOptions,
  type IDrawBondOptions,
} from "../artist";
import type { Molvis } from "../app";
import type { IEntity } from "../system";

@registerCommand("draw_atom")
export class DrawAtom implements ICommand {

  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do(args: {
    name: string;
    x: number;
    y: number;
    z: number;
    options: IDrawAtomOptions;
  }) {
    const { name, x, y, z, options, ...props } = args; 
    const atom = this.app.system.current_frame.add_atom(
      name, x, y, z, props,
    );
    console.log("draw atom", atom);
    const sphere = draw_atom(this.app, atom, options);
    return [[sphere], [atom]] as [Mesh[], IEntity[]];
  }

  public undo() {}
}

@registerCommand("draw_bond")
export class DrawBond implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do(args: {
    x1: number;
    y1: number;
    z1: number;
    x2: number;
    y2: number;
    z2: number;
    props?: Record<string, IProp>;
    options: IDrawBondOptions;
  }) {
    const { x1, y1, z1, x2, y2, z2, props, options } = args;
    const itom = this.app.system.current_frame.add_atom("bond", x1, y1, z1, props);
    const jtom = this.app.system.current_frame.add_atom("bond", x2, y2, z2, props);
    const bond = this.app.system.current_frame.add_bond(itom, jtom, props);
    console.log("draw bond", bond);
    const tube = draw_bond(this.app, bond, options);
    return [[tube], [bond]] as [Mesh[], IEntity[]];
  }

  public undo() {}
}

@registerCommand("draw_frame")
export class DrawFrame implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do(args: {
    atoms: {
      name: string[];
      x: number[];
      y: number[];
      z: number[];
      [key: string]: IProp[]; // Allow additional properties
    };
    bonds: { i: number[]; j: number[] };
    options: IDrawFrameOptions;
  }) {
    const { atoms: atomData, bonds: bondData, options } = args;
    const { name, x, y, z, ...atomProps } = atomData;
    const atomPropKeys = Object.keys(atomProps);

    const atoms = name.map((n, i) => {
      const perAtomProps = atomPropKeys.reduce((acc, key) => {
        acc[key] = atomProps[key][i];
        return acc;
      }, {} as Record<string, IProp>);
      return this.app.system.current_frame.add_atom(n, x[i], y[i], z[i], perAtomProps);
    });

    const bonds: Bond[] = [];
    if (bondData.i && bondData.j) {
      if (bondData.i.length !== bondData.j.length) {
        throw new Error("bond_i and bond_j must have the same length");
      }
      for (let i = 0; i < bondData.i.length; i++) {
        const itom = atoms[bondData.i[i]];
        const jtom = atoms[bondData.j[i]];
        const bond = this.app.system.current_frame.add_bond(itom, jtom);
        bonds.push(bond);
      }
    }

    const frame = new Frame(atoms, bonds);
    console.log("draw frame", frame);
    this.app.system.append_frame(frame);
    const meshes = draw_frame(this.app, frame, options);
    return [meshes, [...frame.atoms, ...frame.bonds]] as [Mesh[], IEntity[]];
  }

  public undo() {}
}
