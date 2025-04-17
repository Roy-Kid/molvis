import { Atom, Bond } from "./item";
import type { IProp } from "./base";

class Frame {
    private _atoms: Atom[];
    private _bonds: Bond[];
    private _props: Map<string, IProp>;

    constructor(atoms: Atom[] = [], bonds: Bond[] = []) {
        this._atoms = atoms;
        this._bonds = bonds;
        this._props = new Map();
    }

    public add_atom(name: string, x: number, y: number, z: number, props?: Record<string, IProp>): Atom {
        const atom = new Atom(name, x, y, z, props);
        this._atoms.push(atom);
        return atom;
    }

    public add_bond(itom: Atom, jtom: Atom, props?: Record<string, IProp>): Bond {
        const bond = new Bond(itom, jtom, props);
        this._bonds.push(bond);
        return bond;
    }

    get atoms(): Atom[] {
        return this._atoms;
    }

    get bonds(): Bond[] {
        return this._bonds;
    }


    // public add_bond = (
    //   itom: Atom,
    //   jtom: Atom,
    //   data: Record<string, Prop[]>; = new Map(),
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

    // get props(): Record<string, Prop[]>; {
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