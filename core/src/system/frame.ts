import { Vector3 } from "@babylonjs/core";
import { Atom, Bond, Prop } from "./item";

class Frame {
  private _atoms: Atom[];
  private _bonds: Bond[];
  private _props: Map<string, Prop>;

  constructor() {
    this._atoms = [];
    this._bonds = [];
    this._props = new Map();
  }

  public add_atom(name: string, xyz: Vector3, props: Record<string, any>): Atom {
    const atom = new Atom();
    atom.set("name", name);
    atom.set("xyz", xyz);
    for (const key in props) {
      atom.set(key, props[key]);
    }
    this._atoms.push(atom);
    return atom;
  }

  public add_bond(itom: Atom, jtom: Atom, props: Record<string, any> = {}): Bond {
    const bond = new Bond(itom, jtom, new Map(Object.entries(props)));
    this._bonds.push(bond);
    return bond;
  }

  public get_atom(fn: (atom: Atom) => boolean): Atom | undefined {
    return this._atoms.find(fn);
  }

  public get_bond(fn: (bond: Bond) => boolean): Bond | undefined {
    return this._bonds.find(fn);
  }

  public remove_atom(atom: Atom) {
    this._atoms = this._atoms.filter(a => a !== atom);
    this._bonds = this._bonds.filter(b => b.itom !== atom && b.jtom !== atom);
  }

  public remove_bond(bond: Bond) {
    this._bonds = this._bonds.filter(b => b !== bond);
  }

  get atoms(): Atom[] {
    return this._atoms;
  }

  get bonds(): Bond[] {
    return this._bonds;
  }

  public clear() {
    this._atoms = [];
    this._bonds = [];
    this._props = new Map();
  }
}

export { Frame };
