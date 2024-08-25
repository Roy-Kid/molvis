import { Vector3 } from "@babylonjs/core";

class System{

    private _traj: Frame[];
    private _current_frame_index: number;

    constructor() {
        this._traj = [new Frame()];
        this._current_frame_index = 0;
    }

    public get current_frame(): Frame {
        return this._traj[this._current_frame_index];
    }
}

class Frame{

    private _atoms: Atom[];
    private _bonds: Bond[];

    constructor() {
        this._atoms = [];
        this._bonds = [];
    }

    public add_atom(x: number, y: number, z: number, props: object): Atom {
        const atom = new Atom(x, y, z, props);
        this._atoms.push(atom);
        return atom;
    }

    public add_bond(itom: Atom, jtom: Atom, props: object): Bond {
        const bond = new Bond(itom, jtom, props);
        this._bonds.push(bond);
        return bond;
    }
}

class Atom {

    public position: Vector3;
    public props: object;

    constructor(x: number, y: number, z: number, props: object) {
        this.position = new Vector3(x, y, z);
        this.props = props;
    }

}

class Bond {

    public itom: Atom;
    public jtom: Atom;
    public props: object;

    constructor(itom: Atom, jtom: Atom, props: object) {
        this.itom = itom;
        this.jtom = jtom;
        this.props = props;
    }
}

export { System, Atom, Bond, Frame };