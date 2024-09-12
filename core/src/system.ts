import { Vector3 } from "@babylonjs/core";

class System{

    private _selected: Atom[];
    private _traj: Frame[];
    private _current_frame_index: number;

    constructor() {
        this._traj = [];
        this._current_frame_index = 0;
        this._selected = [];
    }

    public get current_frame(): Frame {
        return this._traj[this._current_frame_index];
    }

    public get traj(): Frame[] {
        return this._traj;
    }

    public set current_frame_index(idx: number) {
        this._current_frame_index = idx;
    }

    public get_frame(idx: number): Frame {
        return this._traj[idx];
    }

    public change_frame(idx: number) {
        this._current_frame_index = idx;
    }

    public next_frame() {
        this._current_frame_index += 1;
        if (this._current_frame_index >= this._traj.length) {
            this._current_frame_index = this._traj.length - 1;
        }
        return this.current_frame;
    }

    public prev_frame() {
        this._current_frame_index -= 1;
        if (this._current_frame_index < 0) {
            this._current_frame_index = 0;
        }
        return this.current_frame;
    }

    static random_atom_id(): string {
        const randomNum = Math.floor(Math.random() * 0x10000);

        const hexID = randomNum.toString(16).padStart(4, "0");

        return hexID;
    }

    public select_atom(atom: Atom) {
        this._selected.push(atom);
    }

    public append_frame(frame: Frame) {
        this._traj.push(frame);
    }
}

class Frame{

    private _atoms: Atom[];
    private _bonds: Bond[];
    private _props: Map<string, any>;

    constructor() {
        this._atoms = [];
        this._bonds = [];
        this._props = new Map();
    }

    public add_atom = (name: string, x: number, y: number, z: number, props: object = {}): Atom => {
        const atom = new Atom(name, x, y, z, props);
        this._atoms.push(atom);
        return atom;
    }

    public add_bond(itom: Atom, jtom: Atom, props: object): Bond {
        const name = `${itom.name}-${jtom.name}`;
        const bond = new Bond(name, itom, jtom, props);
        this._bonds.push(bond);
        return bond;
    }

    public get_atom_by_name(name: string): Atom | undefined {
        return this._atoms.find(atom => atom.name === name);
    }

    get n_atoms(): number {
        return this._atoms.length;
    }

    get props(): Map<string, any> {
        return this._props;
    }

    get atoms(): Atom[] {
        return this._atoms;
    }

    get bonds(): Bond[] {
        return this._bonds;
    }
}

class Atom {

    public name: string;
    public position: Vector3;
    public props: object;

    constructor(name: string, x: number, y: number, z: number, props: object = {}) {
        this.name = name;
        this.position = new Vector3(x, y, z);
        this.props = props;
    }

}

class Bond {

    public name: string;
    public itom: Atom;
    public jtom: Atom;
    public props: object;

    constructor(name:string, itom: Atom, jtom: Atom, props: object) {
        this.name = name;
        this.itom = itom;
        this.jtom = jtom;
        this.props = props;
    }
}

export { System, Atom, Bond, Frame };