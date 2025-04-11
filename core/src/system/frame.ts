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


    // public add_bond = (
    //   itom: Atom,
    //   jtom: Atom,
    //   data: Map<string, Prop> = new Map(),
    // ): Bond => {
    //   const bond = new Bond(itom, jtom, data);
    //   this._bonds.push(bond);
    //   return bond;
    // };

    // public get_atom = (fn: (atom: Atom) => boolean): Atom | undefined => {
    //   return this._atoms.find(fn);
    // };

    // public get_bond = (fn: (bond: Bond) => boolean): Bond | undefined => {
    //   return this._bonds.find(fn);
    // };

    // get n_atoms(): number {
    //   return this._atoms.length;
    // }

    // get props(): Map<string, Prop> {
    //   return this._props;
    // }

    // get atoms(): Atom[] {
    //   return this._atoms;
    // }

    // get bonds(): Bond[] {
    //   return this._bonds;
    // }

    // set atoms(atoms: Atom[]) {
    //   this._atoms = atoms;
    // }

    // set bonds(bonds: Bond[]) {
    //   this._bonds = bonds;
    // }

    public clear() {
        this._atoms = [];
        this._bonds = [];
        this._props = new Map();
    }
}

export { Frame };